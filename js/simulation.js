/**
 * TCP Congestion Control Simulator — Core AIMD Simulation Engine
 * Phase 1 Implementation
 *
 * Networking Concepts:
 * --------------------
 * - Congestion Window (cwnd): The maximum amount of data (in segments/packets)
 *   that the sender can transmit without receiving an acknowledgement (ACK).
 * - RTT (Round Trip Time): The time taken for a packet to reach the receiver
 *   and for its corresponding ACK to return to the sender.
 * - AIMD (Additive Increase, Multiplicative Decrease):
 *   * Additive Increase (AI): On each successful RTT without packet loss,
 *     the sender increases cwnd linearly by alpha (typically +1 segment/RTT).
 *   * Multiplicative Decrease (MD): When congestion/loss is detected,
 *     the sender reduces cwnd multiplicatively by factor beta (typically * 0.5).
 * - Deterministic Threshold Policy:
 *   In this simplified educational model, congestion is deterministically
 *   triggered whenever the candidate cwnd (currentCwnd + alpha) reaches or
 *   exceeds a predefined congestionThreshold.
 *
 * NOTE: This is an educational, simplified AIMD congestion-avoidance model.
 * It is NOT a full TCP stack (it does not include slow start, dup-ACKs,
 * retransmission timeouts, or queue dynamics).
 */

class AIMDSimulator {
  /**
   * Default configuration parameters
   */
  static DEFAULTS = {
    initialCwnd: 4,
    alpha: 1,
    beta: 0.5,
    congestionThreshold: 12
  };

  /**
   * Constructs a new AIMDSimulator instance with validation.
   * @param {Object} config - Simulator configuration parameters
   * @param {number} [config.initialCwnd=4] - Initial congestion window (segments)
   * @param {number} [config.alpha=1] - Additive increase factor (segments per RTT)
   * @param {number} [config.beta=0.5] - Multiplicative decrease factor (0 < beta < 1)
   * @param {number} [config.congestionThreshold=12] - Deterministic congestion threshold
   */
  constructor(config) {
    if (config !== undefined) {
      if (typeof config !== 'object' || config === null || Array.isArray(config)) {
        throw new Error(`Invalid configuration: config must be an object or undefined. Received: ${config === null ? 'null' : Array.isArray(config) ? 'array' : typeof config}`);
      }
    }

    const mergedConfig = { ...AIMDSimulator.DEFAULTS, ...(config || {}) };
    this._validateConfig(mergedConfig);

    this.initialCwnd = mergedConfig.initialCwnd;
    this.alpha = mergedConfig.alpha;
    this.beta = mergedConfig.beta;
    this.congestionThreshold = mergedConfig.congestionThreshold;

    // Initialize state
    this.reset();
  }

  /**
   * Validates configuration parameters and throws descriptive errors if invalid.
   * @private
   */
  _validateConfig(cfg) {
    // 1. Validate initialCwnd
    if (typeof cfg.initialCwnd !== 'number' || !Number.isFinite(cfg.initialCwnd) || cfg.initialCwnd <= 0) {
      throw new Error(`Invalid configuration: initialCwnd must be a finite positive number. Received: ${cfg.initialCwnd}`);
    }

    // 2. Validate alpha
    if (typeof cfg.alpha !== 'number' || !Number.isFinite(cfg.alpha) || cfg.alpha <= 0) {
      throw new Error(`Invalid configuration: alpha must be a finite positive number. Received: ${cfg.alpha}`);
    }

    // 3. Validate beta
    if (typeof cfg.beta !== 'number' || !Number.isFinite(cfg.beta) || cfg.beta <= 0 || cfg.beta >= 1) {
      throw new Error(`Invalid configuration: beta must be a finite number strictly between 0 and 1 (0 < beta < 1). Received: ${cfg.beta}`);
    }

    // 4. Validate congestionThreshold
    if (typeof cfg.congestionThreshold !== 'number' || !Number.isFinite(cfg.congestionThreshold) || cfg.congestionThreshold <= 0) {
      throw new Error(`Invalid configuration: congestionThreshold must be a finite positive number. Received: ${cfg.congestionThreshold}`);
    }

    // 5. Congestion threshold must be greater than initialCwnd
    if (cfg.congestionThreshold <= cfg.initialCwnd) {
      throw new Error(`Invalid configuration: congestionThreshold (${cfg.congestionThreshold}) must be strictly greater than initialCwnd (${cfg.initialCwnd}).`);
    }
  }

  /**
   * Resets the simulator back to RTT 0 and initial window.
   * Clears simulation history and event logs.
   */
  reset() {
    this.rtt = 0;
    this.cwnd = this.initialCwnd;
    this.history = [];
    this.events = [];

    // Record initial state at RTT 0
    this.recordState(`Simulation initialized. Initial cwnd = ${this.cwnd} MSS, threshold = ${this.congestionThreshold} MSS.`, 'INIT');
  }

  /**
   * Advances the simulation by one RTT round using AIMD rules:
   * 1. Increment RTT.
   * 2. candidateCwnd = currentCwnd + alpha
   * 3. If candidateCwnd < congestionThreshold:
   *      Apply Additive Increase: cwnd = candidateCwnd
   * 4. If candidateCwnd >= congestionThreshold:
   *      Apply Multiplicative Decrease: cwnd = candidateCwnd * beta
   * 5. Record state and return snapshot.
   *
   * @returns {Object} Snapshot of current simulation state
   */
  step() {
    this.rtt += 1;
    const candidateCwnd = this.cwnd + this.alpha;

    if (candidateCwnd < this.congestionThreshold) {
      // Additive Increase phase
      this.cwnd = candidateCwnd;
      const desc = `RTT ${this.rtt}: Additive Increase (+${this.alpha}). cwnd increased to ${this.cwnd}.`;
      this.recordState(desc, 'ADDITIVE_INCREASE');
    } else {
      // Deterministic congestion event & Multiplicative Decrease phase
      const previousCwnd = this.cwnd;
      this.cwnd = candidateCwnd * this.beta;
      const desc = `RTT ${this.rtt}: Congestion event triggered (candidate cwnd ${candidateCwnd} >= threshold ${this.congestionThreshold}). Multiplicative Decrease (x${this.beta}) applied: cwnd reduced from ${previousCwnd} to ${this.cwnd}.`;
      this.recordState(desc, 'CONGESTION_EVENT');
    }

    return this.getState();
  }

  /**
   * Records a snapshot of the current state and event description.
   * @param {string} message - Human-readable description of the event
   * @param {string} [eventType='INFO'] - Type category of the event
   */
  recordState(message, eventType = 'INFO') {
    const entry = {
      rtt: this.rtt,
      cwnd: this.cwnd,
      description: message,
      eventType: eventType
    };

    this.history.push({ ...entry });
    this.events.push({ ...entry });
  }

  /**
   * Returns a deep snapshot of the current state.
   * Protects internal state arrays from external mutations.
   * @returns {Object} State snapshot
   */
  getState() {
    return {
      rtt: this.rtt,
      cwnd: this.cwnd,
      config: {
        initialCwnd: this.initialCwnd,
        alpha: this.alpha,
        beta: this.beta,
        congestionThreshold: this.congestionThreshold
      },
      history: this.history.map(item => ({ ...item })),
      events: this.events.map(item => ({ ...item }))
    };
  }
}

// Support both Browser environments (window.AIMDSimulator) and Node.js environments (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIMDSimulator };
}
if (typeof window !== 'undefined') {
  window.AIMDSimulator = AIMDSimulator;
}
