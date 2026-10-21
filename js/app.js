/**
 * TCP Congestion Control Simulator — Dashboard Controller
 * Phase 4 Implementation: Configurable Simulation Parameters & AIMD Controls
 *
 * Networking Architecture:
 * - The underlying AIMDSimulator engine in js/simulation.js is the SINGLE
 *   source of truth for all mathematical calculations.
 * - This controller manages UI bindings, timer intervals, playback states,
 *   synchronization with the CongestionChart module, PacketAnimator,
 *   and configuration validation/reinitialization.
 * - Timer safety is strictly enforced to guarantee zero duplicate intervals.
 */

(function () {
  'use strict';

  // 1. Verify Simulation Engine Availability
  if (typeof AIMDSimulator === 'undefined') {
    console.error('AIMDSimulator is not loaded. Ensure js/simulation.js is included before js/app.js.');
    return;
  }

  // Single simulator instance for the dashboard session (can be reinitialized on config change)
  let simulator = new AIMDSimulator();

  // 2. Playback State & Configuration
  const DEFAULT_INTERVAL_MS = 1000;
  let timerId = null;
  let playbackStatus = 'READY'; // 'READY' | 'RUNNING' | 'PAUSED'

  // 3. DOM Elements
  const cwndDisplay = document.getElementById('cwnd-display');
  const rttDisplay = document.getElementById('rtt-display');
  const statusDisplay = document.getElementById('status-display');
  const statusSubtext = document.getElementById('status-subtext');
  const thresholdDisplay = document.getElementById('threshold-display');
  const startBtn = document.getElementById('start-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const stepBtn = document.getElementById('step-btn');
  const resetBtn = document.getElementById('reset-btn');
  const eventLogContainer = document.getElementById('event-log');
  const logCountDisplay = document.getElementById('log-count');

  // Settings Panel DOM Elements
  const inputInitialCwnd = document.getElementById('input-initial-cwnd');
  const inputAlpha = document.getElementById('input-alpha');
  const inputBeta = document.getElementById('input-beta');
  const inputThreshold = document.getElementById('input-threshold');
  const settingsForm = document.getElementById('settings-form');
  const applySettingsBtn = document.getElementById('apply-settings-btn');
  const restoreDefaultsBtn = document.getElementById('restore-defaults-btn');
  const settingsFeedback = document.getElementById('settings-feedback');

  /**
   * Formats congestion window values to at most two decimal places.
   * @param {number} value
   * @returns {string}
   */
  function formatCwnd(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return '0';
    }
    return Number.isInteger(value) ? value.toString() : value.toFixed(2);
  }

  /**
   * Updates the UI using the state snapshot from the simulator.
   * @param {Object} state - State returned by simulator.getState() or simulator.step()
   * @param {boolean} [isReset=false] - Whether this update is from a Reset operation
   */
  function updateUI(state, isReset = false) {
    // A. Update Metrics
    if (cwndDisplay) {
      cwndDisplay.textContent = formatCwnd(state.cwnd);
    }
    if (rttDisplay) {
      rttDisplay.textContent = state.rtt.toString();
    }
    if (thresholdDisplay && state.config) {
      thresholdDisplay.textContent = formatCwnd(state.config.congestionThreshold);
    }

    // B. Update Playback Status & Subtext
    if (statusDisplay) {
      statusDisplay.className = 'metric-status';

      if (playbackStatus === 'RUNNING') {
        statusDisplay.textContent = 'Running';
        statusDisplay.classList.add('status-running');
      } else if (playbackStatus === 'PAUSED') {
        statusDisplay.textContent = 'Paused';
        statusDisplay.classList.add('status-paused');
      } else {
        statusDisplay.textContent = 'Ready';
        statusDisplay.classList.add('status-ready');
      }
    }

    if (statusSubtext) {
      if (isReset || state.rtt === 0) {
        statusSubtext.textContent = 'Ready to start (RTT 0)';
      } else {
        const lastEvent = state.events && state.events.length > 0
          ? state.events[state.events.length - 1]
          : null;

        if (lastEvent) {
          if (lastEvent.eventType === 'CONGESTION_EVENT') {
            statusSubtext.textContent = 'Latest: Congestion Event (Multiplicative Decrease)';
          } else if (lastEvent.eventType === 'ADDITIVE_INCREASE') {
            statusSubtext.textContent = 'Latest: Additive Increase (+1)';
          } else {
            statusSubtext.textContent = `Latest: ${lastEvent.description}`;
          }
        } else {
          statusSubtext.textContent = 'Active simulation';
        }
      }
    }

    // C. Render Event Log (Newest events on top for immediate visibility)
    if (eventLogContainer) {
      eventLogContainer.innerHTML = '';

      const events = state.events || [];
      const totalEvents = events.length;

      if (logCountDisplay) {
        logCountDisplay.textContent = `${totalEvents} Event${totalEvents === 1 ? '' : 's'}`;
      }

      for (let i = totalEvents - 1; i >= 0; i--) {
        const evt = events[i];
        const isLatest = i === totalEvents - 1;

        const entry = document.createElement('div');
        entry.className = `log-entry${isLatest ? ' latest' : ''}`;

        let badgeClass = 'badge-init';
        let badgeText = 'INIT';
        if (evt.eventType === 'ADDITIVE_INCREASE') {
          badgeClass = 'badge-ai';
          badgeText = 'ADDITIVE INCREASE';
        } else if (evt.eventType === 'CONGESTION_EVENT') {
          badgeClass = 'badge-congestion';
          badgeText = 'CONGESTION';
        }

        entry.innerHTML = `
          <div class="log-meta">
            <span class="log-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="log-meta">
            <span>RTT ${evt.rtt}</span>
            <span>&bull;</span>
            <span>cwnd ${formatCwnd(evt.cwnd)}</span>
          </div>
          <div class="log-desc">${evt.description}</div>
        `;

        eventLogContainer.appendChild(entry);
      }
    }

    // D. Update Congestion Window Graph
    if (typeof CongestionChart !== 'undefined') {
      if (isReset) {
        const threshold = state.config ? state.config.congestionThreshold : undefined;
        CongestionChart.reset(state.history, threshold);
      } else {
        CongestionChart.update(state.history);
      }
    }

    // E. Synchronize Packet Animation on Reset
    if (isReset && typeof PacketAnimator !== 'undefined') {
      PacketAnimator.reset(state);
    }
  }

  /**
   * Starts automatic simulation playback.
   * Enforces timer safety: prevents multiple concurrent intervals.
   */
  function startPlayback() {
    if (timerId !== null) {
      return; // Prevent duplicate timers
    }

    playbackStatus = 'RUNNING';
    if (startBtn) startBtn.disabled = true;
    if (pauseBtn) pauseBtn.disabled = false;

    if (typeof PacketAnimator !== 'undefined') {
      PacketAnimator.resume();
    }

    updateUI(simulator.getState(), false);

    timerId = setInterval(function () {
      // Step simulator exactly once per tick
      const state = simulator.step();
      updateUI(state, false);
      if (typeof PacketAnimator !== 'undefined') {
        PacketAnimator.animateStep(state);
      }
    }, DEFAULT_INTERVAL_MS);
  }

  /**
   * Pauses automatic simulation progression without resetting engine state.
   */
  function pausePlayback() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }

    playbackStatus = 'PAUSED';
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;

    if (typeof PacketAnimator !== 'undefined') {
      PacketAnimator.pause();
    }

    updateUI(simulator.getState(), false);
  }

  /**
   * Advances the simulation by exactly one manual step.
   * If automatic playback is currently running, pauses it first.
   */
  function stepForward() {
    if (timerId !== null) {
      pausePlayback();
    } else if (playbackStatus === 'READY') {
      playbackStatus = 'PAUSED';
      if (startBtn) startBtn.disabled = false;
      if (pauseBtn) pauseBtn.disabled = true;
    }

    const state = simulator.step();
    updateUI(state, false);
    if (typeof PacketAnimator !== 'undefined') {
      PacketAnimator.animateStep(state);
    }
  }

  /**
   * Halts automatic playback and resets the engine to initial state.
   */
  function resetSimulation() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }

    playbackStatus = 'READY';
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;

    simulator.reset();
    if (typeof PacketAnimator !== 'undefined') {
      PacketAnimator.reset(simulator.getState());
    }
    updateUI(simulator.getState(), true);
  }

  /**
   * Displays validation error or success feedback in the settings panel.
   */
  function showSettingsFeedback(message, isError = true) {
    if (!settingsFeedback) return;
    settingsFeedback.style.display = 'block';
    settingsFeedback.className = `settings-feedback ${isError ? 'feedback-error' : 'feedback-success'}`;
    settingsFeedback.innerHTML = isError
      ? `<strong>Configuration Error:</strong> ${message}`
      : `<strong>Settings Applied:</strong> ${message}`;
  }

  /**
   * Clears settings feedback message.
   */
  function clearSettingsFeedback() {
    if (!settingsFeedback) return;
    settingsFeedback.style.display = 'none';
    settingsFeedback.textContent = '';
    settingsFeedback.className = 'settings-feedback';
  }

  /**
   * Validates user-submitted simulation parameters.
   * Ensures all values are valid finite numbers and conform to AIMD constraints.
   *
   * @param {Object} rawValues
   * @returns {{isValid: boolean, errors: string[], values: Object|null}}
   */
  function validateSettingsInput(rawValues) {
    const errors = [];

    // 1. Initial cwnd
    const rawCwnd = rawValues.initialCwnd;
    if (rawCwnd === '' || rawCwnd === null || rawCwnd === undefined) {
      errors.push('Initial cwnd cannot be empty.');
    } else {
      const val = Number(rawCwnd);
      if (!Number.isFinite(val) || isNaN(val)) {
        errors.push('Initial cwnd must be a valid finite number.');
      } else if (val <= 0) {
        errors.push('Initial cwnd must be strictly greater than 0.');
      }
    }

    // 2. Alpha (Additive Increase)
    const rawAlpha = rawValues.alpha;
    if (rawAlpha === '' || rawAlpha === null || rawAlpha === undefined) {
      errors.push('Alpha (α) cannot be empty.');
    } else {
      const val = Number(rawAlpha);
      if (!Number.isFinite(val) || isNaN(val)) {
        errors.push('Alpha (α) must be a valid finite number.');
      } else if (val <= 0) {
        errors.push('Alpha (α) must be strictly greater than 0.');
      }
    }

    // 3. Beta (Multiplicative Decrease)
    const rawBeta = rawValues.beta;
    if (rawBeta === '' || rawBeta === null || rawBeta === undefined) {
      errors.push('Beta (β) cannot be empty.');
    } else {
      const val = Number(rawBeta);
      if (!Number.isFinite(val) || isNaN(val)) {
        errors.push('Beta (β) must be a valid finite number.');
      } else if (val <= 0 || val >= 1) {
        errors.push('Beta (β) must be strictly between 0 and 1 (0 < β < 1).');
      }
    }

    // 4. Congestion Threshold
    const rawThresh = rawValues.congestionThreshold;
    if (rawThresh === '' || rawThresh === null || rawThresh === undefined) {
      errors.push('Congestion threshold cannot be empty.');
    } else {
      const val = Number(rawThresh);
      if (!Number.isFinite(val) || isNaN(val)) {
        errors.push('Congestion threshold must be a valid finite number.');
      } else if (val <= 0) {
        errors.push('Congestion threshold must be strictly greater than 0.');
      }
    }

    // 5. Cross-field: Congestion threshold must be strictly greater than initial cwnd
    if (errors.length === 0) {
      const initVal = Number(rawCwnd);
      const threshVal = Number(rawThresh);
      if (threshVal <= initVal) {
        errors.push(`Congestion threshold (${threshVal}) must be strictly greater than Initial cwnd (${initVal}).`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      values: errors.length === 0 ? {
        initialCwnd: Number(rawCwnd),
        alpha: Number(rawAlpha),
        beta: Number(rawBeta),
        congestionThreshold: Number(rawThresh)
      } : null
    };
  }

  /**
   * Applies validated simulation parameters safely.
   */
  function applySettings(e) {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    const rawValues = {
      initialCwnd: inputInitialCwnd ? inputInitialCwnd.value.trim() : '',
      alpha: inputAlpha ? inputAlpha.value.trim() : '',
      beta: inputBeta ? inputBeta.value.trim() : '',
      congestionThreshold: inputThreshold ? inputThreshold.value.trim() : ''
    };

    const validation = validateSettingsInput(rawValues);

    if (!validation.isValid) {
      showSettingsFeedback(validation.errors.join(' '), true);
      return; // Do NOT modify the running simulation or state
    }

    // Stop automatic playback safely
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
    playbackStatus = 'READY';
    if (startBtn) startBtn.disabled = false;
    if (pauseBtn) pauseBtn.disabled = true;

    // Cancel in-flight animations safely
    if (typeof PacketAnimator !== 'undefined') {
      PacketAnimator.stopCurrentAnimation();
    }

    // Reinitialize simulator instance with validated config
    simulator = new AIMDSimulator(validation.values);

    // Update UI (metrics, chart, animation, log)
    updateUI(simulator.getState(), true);

    showSettingsFeedback(`Configured: initial cwnd = ${validation.values.initialCwnd}, α = ${validation.values.alpha}, β = ${validation.values.beta}, threshold = ${validation.values.congestionThreshold}. Ready to run.`, false);
  }

  /**
   * Restores default parameters (4, 1, 0.5, 12) and applies them through the validated flow.
   */
  function restoreDefaults() {
    if (inputInitialCwnd) inputInitialCwnd.value = '4';
    if (inputAlpha) inputAlpha.value = '1';
    if (inputBeta) inputBeta.value = '0.5';
    if (inputThreshold) inputThreshold.value = '12';

    clearSettingsFeedback();
    applySettings();
  }

  // 4. Bind Control Listeners
  if (startBtn) {
    startBtn.addEventListener('click', startPlayback);
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', pausePlayback);
  }

  if (stepBtn) {
    stepBtn.addEventListener('click', stepForward);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetSimulation);
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', applySettings);
  }

  if (restoreDefaultsBtn) {
    restoreDefaultsBtn.addEventListener('click', restoreDefaults);
  }

  // Clear error feedback when user edits input fields
  [inputInitialCwnd, inputAlpha, inputBeta, inputThreshold].forEach(el => {
    if (el) el.addEventListener('input', clearSettingsFeedback);
  });

  // 5. Initialize Animation & Live Congestion Window Graph
  if (typeof PacketAnimator !== 'undefined') {
    PacketAnimator.init();
  }
  if (typeof CongestionChart !== 'undefined') {
    CongestionChart.init('cwnd-chart', simulator.getState().history);
  }

  // 6. Initial Render on Load
  updateUI(simulator.getState(), true);
})();
