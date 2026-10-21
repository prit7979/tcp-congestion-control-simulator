# TCP Congestion Control Simulator (AIMD)

An interactive, browser-based educational simulator demonstrating the **Additive Increase, Multiplicative Decrease (AIMD)** congestion avoidance algorithm in computer networks. Built with pure HTML5, modern CSS3, vanilla JavaScript, and Chart.js.

Designed as an educational demonstration and laboratory tool for Computer Networks (B.Tech Computer Science / Information Technology).

---
## 1. Overview & Theoretical Background
### What is TCP Congestion Control?
In packet-switched computer networks, multiple senders share intermediate router buffers and network links. If transmitters send packets faster than intermediate network nodes can process and forward them, buffers overflow, leading to packet drops, excessive retransmissions, and network congestion collapse.

TCP uses end-to-end congestion control to dynamically discover and adapt to available network bandwidth without explicit feedback from network routers.

### The AIMD Algorithm
**Additive Increase, Multiplicative Decrease (AIMD)** is the feedback-control algorithm at the heart of TCP Congestion Avoidance:

1. **Additive Increase (AI):**
   - When all segments transmitted in a round-trip time (RTT) are successfully acknowledged (no packet loss detected), the sender probes for extra bandwidth by linearly increasing the Congestion Window:
     $$\text{cwnd}_{t+1} = \text{cwnd}_t + \alpha$$
   - By default, $\alpha = 1\text{ MSS (Maximum Segment Size)}$ per RTT.

2. **Multiplicative Decrease (MD):**
   - When congestion occurs (indicated by packet loss), the sender relieves network congestion by drastically scaling down its congestion window:
     $$\text{cwnd}_{t+1} = \max(1, \lfloor \text{cwnd}_t \times \beta \rfloor)$$
   - By default, $\beta = 0.5$ (a 50% window reduction).

Over time, this creates the characteristic **TCP sawtooth pattern** that balances network link utilization and fairness among competing flows.

---

## 2. Key Concepts & Simulation Parameters

| Parameter | Symbol / Label | Default | Description |
|:---|:---|:---:|:---|
| **Congestion Window** | `cwnd` | `4` | Starting congestion window volume (in MSS segments). |
| **Round Trip Time** | `RTT` | `0` | Starting RTT round index (advances 1, 2, ... upon each transmission). |
| **Additive Increase** | $\alpha$ (`alpha`) | `1` | Number of segments added to `cwnd` per successful RTT round. |
| **Multiplicative Factor** | $\beta$ (`beta`) | `0.5` | Multiplier applied to `cwnd` upon detecting congestion ($0 < \beta < 1$). |
| **Congestion Threshold** | `threshold` | `12` | The candidate window limit triggering deterministic packet loss in this model. |

### Educational Model Scope Note
> **Note on Model Simplification:** This simulator implements a **deterministic, threshold-based educational model** of TCP AIMD congestion avoidance. To clearly demonstrate the mathematical sawtooth dynamics and packet flow for students, it abstracts away Slow Start exponential growth, Fast Retransmit / Fast Recovery state transitions, retransmission timeouts (RTOs), and triple duplicate ACKs.

---

## 3. Project Architecture & File Structure

The project follows a clean, modular architecture with zero server-side dependencies and zero JavaScript framework overhead:

```text
tcp-congestion-control-simulator/
│
├── index.html                   # Main interactive dashboard
├── css/
│   └── style.css                # Dark-themed responsive stylesheet (WCAG accessible)
├── js/
│   ├── simulation.js            # Pure AIMD simulation engine (Single source of truth)
│   ├── chart.js                 # Chart.js live cwnd vs RTT graph wrapper
│   ├── animation.js             # Packet & ACK transmission visualizer
│   └── app.js                   # Application controller & UI coordinator
├── tests/
│   └── simulation-tests.html    # In-browser test runner for AIMD engine (14 tests)
└── README.md                    # Project documentation
```

### Module Responsibilities:
- **`simulation.js` (`AIMDSimulator`)**: Independent state machine that manages `cwnd`, `rtt`, `alpha`, `beta`, `threshold`, and emits event objects (`INIT`, `ADDITIVE_INCREASE`, `CONGESTION_EVENT`, `RESET`).
- **`chart.js` (`CongestionChart`)**: Manages the Chart.js line plot, threshold indicator line, dynamic headroom scaling, and responsive resizing.
- **`animation.js` (`PacketAnimator`)**: Renders packet flights along forward/reverse paths, packet drop markers on congestion, and handles sequence cancellation and pause freezing.
- **`app.js`**: Binds UI controls (Start, Pause, Step Forward, Reset, Apply Settings, Restore Defaults), performs input validation, updates metric badges, and coordinates DOM event logging.

---

## 4. Features

- **Live Dashboard Metrics**: Displays current `cwnd`, current `RTT`, additive increase amount, multiplicative factor, and real-time status badge (`Ready`, `Additive Increase`, `Congestion Event`).
- **Configurable Settings Panel**:
  - Live validation for Initial cwnd, Threshold, Alpha, and Beta.
  - Descriptive feedback messages for invalid entries.
  - One-click *Restore Defaults* button.
- **Interactive Controls**:
  - **Step Forward**: Manually advances the simulation by 1 RTT round.
  - **Start / Pause**: Automatically runs the simulation at 1 RTT/sec with freeze-frame support.
  - **Reset**: Restores initial conditions while keeping the user's active configuration.
- **Live Congestion Window Graph**:
  - Real-time Chart.js curve plotting cwnd over RTT.
  - Dashed red threshold line illustrating the congestion boundary.
  - Dynamic Y-axis headroom adapting to custom thresholds.
- **Packet and ACK Animation**:
  - Visual Sender and Receiver terminal nodes.
  - Moving data packets (`Data (N MSS)`) travelling on the forward path.
  - Returning acknowledgement markers (`ACK`) on the reverse path.
  - Mid-flight packet drop marker and red warning state during congestion rounds.
- **Synchronized Event Log**:
  - Timestamped, reverse-chronological record of every RTT event.
  - Color-coded badges for initialization, increase, and congestion drops.
- **Accessibility & Responsiveness**:
  - Complete keyboard navigation with high-visibility `:focus-visible` outlines.
  - WCAG-compliant touch targets ($\ge 44\text{px}$) for mobile devices.
  - Fluid responsive layouts across Desktop ($\ge 1100\text{px}$), Tablet ($768\text{px}$), and Mobile ($375\text{px}$).
  - Respects `prefers-reduced-motion` user preferences.

---

## 5. Getting Started & Running Locally

Because the project is written in standard web technologies with no compilation or build steps, it can be run using any static file server:

### Option A: Using Python
```bash
# In the project root directory:
python -m http.server 3000
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Option B: Using Node.js
```bash
npx serve .
# or
npx http-server .
```

### Option C: Direct Browser Opening
Simply double-click `index.html` or open it directly in Google Chrome, Mozilla Firefox, Microsoft Edge, or Safari.

---

## 6. Running the Unit Test Suite

The simulator includes a 14-test unit test suite verifying the mathematical correctness and boundary handling of the `AIMDSimulator` engine:

1. **In the Browser**:
   - Navigate to [http://localhost:3000/tests/simulation-tests.html](http://localhost:3000/tests/simulation-tests.html) or click **"Run Test Suite (14 Tests)"** in the top navigation bar.
2. **Test Coverage**:
   - `testInitialization`: Verifies default and custom initial state.
   - `testAdditiveIncrease`: Verifies linear increment per congestion-free RTT round.
   - `testCongestionDetection`: Verifies congestion detection when candidate cwnd reaches threshold.
   - `testMultiplicativeDecrease`: Verifies 50% window reduction upon congestion.
   - `testMinimumCwndBound`: Verifies cwnd never drops below 1 segment.
   - `testMultipleCycles`: Verifies sustained periodic sawtooth behavior across multiple rounds.
   - `testResetState`: Verifies engine reset restores initial parameters and clears history.
   - `testCustomConfiguration`: Verifies custom alpha, beta, and threshold settings.
   - `testEventGeneration`: Verifies accurate event logging for `INIT`, `ADDITIVE_INCREASE`, and `CONGESTION_EVENT`.
   - `testInvalidConfigHandling`: Verifies robust fallback for non-positive or malformed parameters.

---

## 7. Technologies Used

- **HTML5**: Semantic document structure with ARIA landmark regions.
- **CSS3**: Custom properties (CSS variables), CSS Grid, Flexbox, custom scrollbars, and media queries.
- **JavaScript (ES6+)**: Vanilla object-oriented / module pattern code.
- **Chart.js (v4.4.1)**: Canvas-based line chart visualization.

---

## 8. License & Academic Attribution
Developed for educational demonstration of TCP Congestion Control and AIMD dynamics in computer networking curricula.
