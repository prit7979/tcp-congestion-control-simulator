/**
 * TCP Congestion Control Simulator — Dashboard Controller
 * Phase 2.1 Implementation
 *
 * This controller binds the HTML dashboard interface to the underlying
 * AIMDSimulator engine. The simulation engine remains the single source
 * of truth; calculations are never duplicated here.
 */

(function () {
  'use strict';

  // 1. Initialize Simulator (Single Source of Truth)
  if (typeof AIMDSimulator === 'undefined') {
    console.error('AIMDSimulator is not loaded. Ensure js/simulation.js is included before js/app.js.');
    return;
  }

  const simulator = new AIMDSimulator();

  // 2. DOM Elements
  const cwndDisplay = document.getElementById('cwnd-display');
  const rttDisplay = document.getElementById('rtt-display');
  const statusDisplay = document.getElementById('status-display');
  const thresholdDisplay = document.getElementById('threshold-display');
  const stepBtn = document.getElementById('step-btn');
  const resetBtn = document.getElementById('reset-btn');
  const eventLogContainer = document.getElementById('event-log');
  const logCountDisplay = document.getElementById('log-count');

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
   * @param {boolean} [isReset=false] - Whether this update is a Reset operation
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

    // B. Update Status Display
    if (statusDisplay) {
      statusDisplay.className = 'metric-status';
      if (isReset || state.rtt === 0) {
        statusDisplay.textContent = 'Ready';
        statusDisplay.classList.add('status-ready');
      } else {
        const lastEvent = state.events[state.events.length - 1];
        if (lastEvent && lastEvent.eventType === 'CONGESTION_EVENT') {
          statusDisplay.textContent = 'Congestion Detected (Multiplicative Decrease)';
          statusDisplay.classList.add('status-congestion');
        } else if (lastEvent && lastEvent.eventType === 'ADDITIVE_INCREASE') {
          statusDisplay.textContent = 'Additive Increase (+1)';
          statusDisplay.classList.add('status-ai');
        } else {
          statusDisplay.textContent = 'Active';
          statusDisplay.classList.add('status-ready');
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

      // Render in reverse chronological order (newest first)
      for (let i = totalEvents - 1; i >= 0; i--) {
        const evt = events[i];
        const isLatest = i === totalEvents - 1;

        const entry = document.createElement('div');
        entry.className = `log-entry${isLatest ? ' latest' : ''}`;

        // Select badge style based on eventType
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
  }

  // 3. Step Forward Action
  if (stepBtn) {
    stepBtn.addEventListener('click', function () {
      // Call existing step() method exactly once
      const state = simulator.step();
      updateUI(state, false);
    });
  }

  // 4. Reset Action
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      // Call existing reset() method
      simulator.reset();
      const state = simulator.getState();
      updateUI(state, true);
    });
  }

  // 5. Initial Render on Load
  updateUI(simulator.getState(), true);
})();
