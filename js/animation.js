/**
 * TCP Congestion Control Simulator — Packet & ACK Animation Module
 * Phase 3 Implementation: Real-Time Packet and ACK Transmission Animation
 *
 * Networking Concepts:
 * --------------------
 * - Forward Path: The sender transmits TCP data packets (representing cwnd segments).
 * - Reverse Path: The receiver sends Acknowledgement (ACK) indicators back to sender.
 * - Additive Increase: When an ACK is received for all in-flight segments, sender
 *   increases its congestion window by alpha (+1 segment).
 * - Congestion Event: When packet loss occurs (candidate cwnd >= threshold), packets
 *   are dropped/lost, and Multiplicative Decrease reduces cwnd by beta (* 0.5).
 *
 * Responsibilities:
 * - Animates packets travelling from Sender (left) to Receiver (right).
 * - Animates return ACKs from Receiver (right) to Sender (left).
 * - Clearly highlights Congestion events (packet loss, drop animation, warning indicator).
 * - Strictly synchronizes with AIMDSimulator state and events.
 * - Safely handles Pause (freezes visual motion, stops timers).
 * - Safely handles Reset (cancels pending timers, clears DOM elements, restores initial idle state).
 * - Prevents duplicate timers, overlapping animations, or orphan callbacks.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PacketAnimator = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // DOM element references
  let stageEl = null;
  let inFlightContainer = null;
  let senderCwndEl = null;
  let receiverStatusEl = null;
  let channelStatusEl = null;
  let statusBadgeEl = null;
  let senderNodeEl = null;
  let receiverNodeEl = null;

  // Animation execution state
  const activeTimeouts = new Set();
  let currentSequenceId = 0;
  let isPaused = false;

  /**
   * Safe timeout wrapper that registers timers in activeTimeouts and checks sequence validity.
   * Prevents callbacks from executing if the sequence has changed (e.g. after Reset or Step).
   *
   * @param {Function} callback - Function to execute
   * @param {number} delayMs - Delay in milliseconds
   * @param {number} seqId - Sequence ID for tracking
   * @returns {number} Timer ID
   */
  function safeSetTimeout(callback, delayMs, seqId) {
    const timerId = setTimeout(function () {
      activeTimeouts.delete(timerId);
      // Ensure callback only runs if this sequence is still current and not paused
      if (seqId !== undefined && seqId !== currentSequenceId) {
        return;
      }
      callback();
    }, delayMs);

    activeTimeouts.add(timerId);
    return timerId;
  }

  /**
   * Clears all pending animation timers.
   */
  function clearAllTimers() {
    activeTimeouts.forEach(function (timerId) {
      clearTimeout(timerId);
    });
    activeTimeouts.clear();
  }

  /**
   * Formats cwnd values for labels (e.g. 4 or 5.5).
   * @param {number} val
   * @returns {string}
   */
  function formatCwnd(val) {
    if (typeof val !== 'number' || !Number.isFinite(val)) return '0';
    return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  }

  /**
   * Initializes the animator module with DOM elements.
   * Can be called with custom elements or resolves defaults from document IDs.
   *
   * @param {Object} [options]
   */
  function init(options) {
    options = options || {};
    stageEl = options.stageEl || document.getElementById('network-stage');
    inFlightContainer = options.inFlightContainer || document.getElementById('in-flight-container');
    senderCwndEl = options.senderCwndEl || document.getElementById('anim-sender-cwnd');
    receiverStatusEl = options.receiverStatusEl || document.getElementById('anim-receiver-status');
    channelStatusEl = options.channelStatusEl || document.getElementById('anim-channel-status');
    statusBadgeEl = options.statusBadgeEl || document.getElementById('anim-status-badge');
    senderNodeEl = options.senderNodeEl || document.getElementById('sender-node');
    receiverNodeEl = options.receiverNodeEl || document.getElementById('receiver-node');

    reset();
  }

  /**
   * Halts any active animation, cancels all pending timers, and removes moving elements.
   */
  function stopCurrentAnimation() {
    clearAllTimers();
    if (inFlightContainer) {
      inFlightContainer.innerHTML = '';
    }
    if (stageEl) {
      stageEl.classList.remove('is-paused');
    }
    if (senderNodeEl) {
      senderNodeEl.classList.remove('node-transmitting', 'node-congestion');
    }
    if (receiverNodeEl) {
      receiverNodeEl.classList.remove('node-receiving', 'node-loss');
    }
  }

  /**
   * Animates a single simulation step based on engine event and state.
   *
   * Lifecycle of a step animation:
   * 1. If Additive Increase:
   *    - Forward packet travels from Sender to Receiver (0ms - 420ms).
   *    - Receiver accepts data, flashes green, generates ACK (420ms).
   *    - ACK travels from Receiver to Sender (480ms - 880ms).
   *    - Sender receives ACK, updates window, logs completion (880ms).
   * 2. If Congestion Event:
   *    - Data packet travels towards Receiver (0ms - 420ms).
   *    - Mid-flight drop / loss occurs, showing red loss indicator (420ms).
   *    - Receiver detects missing segments (420ms).
   *    - Multiplicative Decrease reduces cwnd by 50% at Sender (700ms - 900ms).
   *
   * @param {Object} state - State snapshot from AIMDSimulator
   */
  function animateStep(state) {
    if (!state) return;

    // Lazily resolve container if init wasn't called explicitly
    if (!inFlightContainer) {
      init();
    }
    if (!inFlightContainer) return;

    isPaused = false;

    // Cancel any ongoing animation and timers before starting the new step
    stopCurrentAnimation();

    const seqId = ++currentSequenceId;
    const events = state.events || [];
    const lastEvent = events.length > 0 ? events[events.length - 1] : null;
    const isCongestion = lastEvent && lastEvent.eventType === 'CONGESTION_EVENT';
    const cwndStr = formatCwnd(state.cwnd);

    // Initial visual setup for the step
    if (statusBadgeEl) {
      statusBadgeEl.className = 'animation-status-badge ' + (isCongestion ? 'status-congestion' : 'status-transmitting');
      statusBadgeEl.textContent = isCongestion ? 'Congestion' : 'Transmitting';
    }
    if (senderNodeEl) {
      senderNodeEl.classList.add(isCongestion ? 'node-congestion' : 'node-transmitting');
    }
    if (senderCwndEl) {
      senderCwndEl.textContent = 'cwnd: ' + cwndStr;
    }
    if (receiverStatusEl) {
      receiverStatusEl.textContent = 'Listening...';
    }
    if (channelStatusEl) {
      channelStatusEl.className = 'channel-status';
      if (isCongestion) {
        channelStatusEl.textContent = 'RTT ' + state.rtt + ': Candidate window >= threshold! In-flight packets dropped...';
      } else {
        channelStatusEl.textContent = 'RTT ' + state.rtt + ': Transmitting ' + cwndStr + ' segments across forward path...';
      }
    }

    if (!isCongestion) {
      // =========================================================================
      // SUCCESSFUL TRANSMISSION & ADDITIVE INCREASE FLOW
      // =========================================================================

      // 1. Forward Packet: Sender -> Receiver
      const packetEl = document.createElement('div');
      packetEl.className = 'in-flight-item packet-item anim-fly-forward';
      packetEl.innerHTML = '<span class="packet-sym">&#9638;</span> <span class="packet-txt">Data (' + cwndStr + ' MSS)</span>';
      inFlightContainer.appendChild(packetEl);

      // 2. Arrival at Receiver (~420ms)
      safeSetTimeout(function () {
        if (receiverNodeEl) receiverNodeEl.classList.add('node-receiving');
        if (receiverStatusEl) receiverStatusEl.textContent = 'RTT ' + state.rtt + ' Received';
        if (channelStatusEl) channelStatusEl.textContent = 'RTT ' + state.rtt + ': All segments received. Emitting ACK...';

        // 3. Reverse ACK: Receiver -> Sender (~480ms - 880ms)
        safeSetTimeout(function () {
          if (packetEl.parentNode) packetEl.parentNode.removeChild(packetEl);

          if (statusBadgeEl) {
            statusBadgeEl.className = 'animation-status-badge status-ack';
            statusBadgeEl.textContent = 'Acknowledged';
          }

          const ackEl = document.createElement('div');
          ackEl.className = 'in-flight-item ack-item anim-fly-reverse';
          ackEl.innerHTML = '<span class="ack-sym">&#10003;</span> <span class="ack-txt">ACK ' + state.rtt + '</span>';
          inFlightContainer.appendChild(ackEl);

          if (channelStatusEl) {
            channelStatusEl.textContent = 'RTT ' + state.rtt + ': Returning cumulative ACK to sender...';
          }

          // 4. Arrival of ACK at Sender (~880ms)
          safeSetTimeout(function () {
            if (ackEl.parentNode) ackEl.parentNode.removeChild(ackEl);
            if (senderNodeEl) senderNodeEl.classList.remove('node-transmitting');
            if (receiverNodeEl) receiverNodeEl.classList.remove('node-receiving');
            if (channelStatusEl) {
              channelStatusEl.textContent = 'RTT ' + state.rtt + ' complete: ACK received (+1 Additive Increase). cwnd = ' + cwndStr + '.';
            }
            if (statusBadgeEl) {
              statusBadgeEl.className = 'animation-status-badge status-idle';
              statusBadgeEl.textContent = 'ACK Received';
            }
          }, 400, seqId);
        }, 60, seqId);
      }, 420, seqId);

    } else {
      // =========================================================================
      // CONGESTION EVENT & MULTIPLICATIVE DECREASE FLOW
      // =========================================================================

      // 1. Data Packet moving towards threshold/loss zone
      const packetEl = document.createElement('div');
      packetEl.className = 'in-flight-item packet-item packet-congestion anim-fly-drop';
      packetEl.innerHTML = '<span class="packet-sym">&#9638;</span> <span class="packet-txt">Segments (Loss)</span>';
      inFlightContainer.appendChild(packetEl);

      // 2. Mid-flight Loss Detected (~420ms)
      safeSetTimeout(function () {
        const lossMarker = document.createElement('div');
        lossMarker.className = 'in-flight-item loss-marker';
        lossMarker.innerHTML = '<span class="loss-icon">&#9888;</span> <span>CONGESTION DETECTED</span>';
        inFlightContainer.appendChild(lossMarker);

        if (receiverNodeEl) receiverNodeEl.classList.add('node-loss');
        if (receiverStatusEl) receiverStatusEl.textContent = 'Packet Loss!';
        if (channelStatusEl) {
          channelStatusEl.className = 'channel-status status-alert';
          channelStatusEl.textContent = 'RTT ' + state.rtt + ': Network buffer exceeded! Loss detected. Multiplicative Decrease applied.';
        }

        // 3. Multiplicative Decrease reaction at Sender (~700ms)
        safeSetTimeout(function () {
          if (senderCwndEl) {
            senderCwndEl.textContent = 'cwnd: ' + cwndStr;
          }
          if (statusBadgeEl) {
            statusBadgeEl.className = 'animation-status-badge status-congestion';
            statusBadgeEl.textContent = 'Window Cut (x0.5)';
          }
          if (channelStatusEl) {
            channelStatusEl.textContent = 'RTT ' + state.rtt + ': cwnd reduced to ' + cwndStr + ' segments. Backing off transmission rate.';
          }

          // 4. Cleanup loss indication (~900ms)
          safeSetTimeout(function () {
            if (lossMarker.parentNode) lossMarker.parentNode.removeChild(lossMarker);
            if (packetEl.parentNode) packetEl.parentNode.removeChild(packetEl);
            if (senderNodeEl) senderNodeEl.classList.remove('node-congestion');
            if (receiverNodeEl) receiverNodeEl.classList.remove('node-loss');
          }, 200, seqId);
        }, 280, seqId);
      }, 420, seqId);
    }
  }

  /**
   * Pauses the animation: freezes CSS animations and clears pending timers.
   */
  function pause() {
    isPaused = true;
    clearAllTimers();
    if (stageEl) {
      stageEl.classList.add('is-paused');
    }
    if (statusBadgeEl) {
      statusBadgeEl.className = 'animation-status-badge status-paused';
      statusBadgeEl.textContent = 'Paused';
    }
    if (channelStatusEl) {
      channelStatusEl.textContent = 'Simulation paused';
    }
  }

  /**
   * Resumes animation when playback restarts (if was paused).
   */
  function resume() {
    if (!isPaused) return;
    isPaused = false;
    if (stageEl) {
      stageEl.classList.remove('is-paused');
    }
    if (statusBadgeEl) {
      statusBadgeEl.className = 'animation-status-badge status-transmitting';
      statusBadgeEl.textContent = 'Running';
    }
  }

  /**
   * Resets the animation module back to initial visual state.
   * Cancels all timers, clears all moving elements, and restores initial badges.
   *
   * @param {Object} [state] - Optional reset state from simulator
   */
  function reset(state) {
    isPaused = false;
    currentSequenceId++;
    stopCurrentAnimation();

    const initialCwnd = (state && state.config && state.config.initialCwnd) || 4;

    if (senderCwndEl) {
      senderCwndEl.textContent = 'cwnd: ' + formatCwnd(initialCwnd);
    }
    if (receiverStatusEl) {
      receiverStatusEl.textContent = 'Listening';
    }
    if (channelStatusEl) {
      channelStatusEl.className = 'channel-status';
      channelStatusEl.textContent = 'Ready to transmit (RTT 0)';
    }
    if (statusBadgeEl) {
      statusBadgeEl.className = 'animation-status-badge status-idle';
      statusBadgeEl.textContent = 'Idle';
    }
  }

  return {
    init: init,
    animateStep: animateStep,
    pause: pause,
    resume: resume,
    reset: reset,
    stopCurrentAnimation: stopCurrentAnimation
  };
});
