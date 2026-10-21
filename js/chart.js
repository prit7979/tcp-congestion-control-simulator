/**
 * TCP Congestion Control Simulator — Chart Visualization Module
 * Phase 2.3 Implementation: Live Congestion Window Graph
 *
 * Responsibilities:
 * - Initializes and manages the Chart.js line graph of cwnd vs RTT.
 * - Reads data directly from AIMDSimulator's recorded history (single source of truth).
 * - Avoids duplicate points and preserves fractional values without rounding.
 * - Manages a single Chart instance across the application lifecycle.
 * - Fits the dark dashboard theme with clear axes, labels, and gridlines.
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.CongestionChart = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let chartInstance = null;

  /**
   * Initializes the Congestion Window vs RTT chart.
   * If already initialized, updates it with initialHistory instead of recreating.
   *
   * @param {string|HTMLCanvasElement} canvasTarget - ID or DOM element of canvas
   * @param {Array<Object>} [initialHistory] - Initial simulator history array
   * @returns {Object|null} The Chart instance, or null if Chart.js is unavailable
   */
  function init(canvasTarget, initialHistory) {
    if (typeof Chart === 'undefined') {
      console.error('Chart.js library is not loaded. Ensure CDN script is included before js/chart.js.');
      return null;
    }

    if (chartInstance) {
      if (Array.isArray(initialHistory) && initialHistory.length > 0) {
        update(initialHistory);
      }
      return chartInstance;
    }

    const canvas = typeof canvasTarget === 'string'
      ? document.getElementById(canvasTarget)
      : canvasTarget;

    if (!canvas) {
      console.error(`Canvas target not found: ${canvasTarget}`);
      return null;
    }

    // Default initial data: RTT = 0, cwnd = 4
    const history = Array.isArray(initialHistory) && initialHistory.length > 0
      ? initialHistory
      : [{ rtt: 0, cwnd: 4 }];

    const labels = history.map(item => item.rtt);
    const data = history.map(item => item.cwnd);

    const ctx = canvas.getContext('2d');

    // Area gradient matching the #00C2FF theme on #0A0F2C / #2E2A68
    let fillGradient = 'rgba(0, 194, 255, 0.12)';
    try {
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(0, 194, 255, 0.28)');
      gradient.addColorStop(1, 'rgba(0, 194, 255, 0.01)');
      fillGradient = gradient;
    } catch (e) {
      // Fallback to solid rgba
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Congestion Window (cwnd)',
            data: data,
            borderColor: '#00C2FF',
            backgroundColor: fillGradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.05, // Sharp near-linear segments clearly depicting AIMD sawtooth
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#00C2FF',
            pointBorderColor: '#0A0F2C',
            pointBorderWidth: 2,
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: '#00C2FF'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 250 // Smooth transition between RTT steps
        },
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: '#D1D5F5',
              font: {
                size: 12,
                weight: '500'
              },
              boxWidth: 12,
              boxHeight: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: '#0A0F2C',
            titleColor: '#ffffff',
            bodyColor: '#D1D5F5',
            borderColor: '#00C2FF',
            borderWidth: 1,
            padding: 10,
            displayColors: false,
            callbacks: {
              title: function (items) {
                if (!items || items.length === 0) return '';
                return `RTT Round: ${items[0].label}`;
              },
              label: function (context) {
                const val = context.parsed.y;
                return `cwnd: ${val} segments`;
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'RTT (Round Trip Time)',
              color: '#D1D5F5',
              font: {
                size: 12,
                weight: '600'
              },
              padding: { top: 8 }
            },
            ticks: {
              color: '#D1D5F5',
              font: {
                size: 11
              },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 25
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
              drawBorder: false
            }
          },
          y: {
            title: {
              display: true,
              text: 'Congestion Window (cwnd)',
              color: '#D1D5F5',
              font: {
                size: 12,
                weight: '600'
              },
              padding: { bottom: 8 }
            },
            ticks: {
              color: '#D1D5F5',
              font: {
                size: 11
              },
              precision: 2
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.08)',
              drawBorder: false
            },
            beginAtZero: true,
            suggestedMax: 14 // Comfortable margin above default threshold of 12
          }
        }
      }
    });

    return chartInstance;
  }

  /**
   * Updates the chart using the simulator's recorded history.
   * Prevents duplicate points and only redraws if the history has changed.
   *
   * @param {Array<Object>} history - Array of history objects from AIMDSimulator
   */
  function update(history) {
    if (!chartInstance || !Array.isArray(history) || history.length === 0) {
      return;
    }

    const newLabels = history.map(item => item.rtt);
    const newData = history.map(item => item.cwnd);

    const currentLabels = chartInstance.data.labels;
    const currentData = chartInstance.data.datasets[0].data;

    // Check if new data is identical to current chart state (prevents duplicate redraws)
    if (
      currentLabels.length === newLabels.length &&
      currentLabels[currentLabels.length - 1] === newLabels[newLabels.length - 1] &&
      currentData[currentData.length - 1] === newData[newData.length - 1]
    ) {
      return;
    }

    chartInstance.data.labels = newLabels;
    chartInstance.data.datasets[0].data = newData;
    chartInstance.update();
  }

  /**
   * Resets the chart to initial state (RTT 0, cwnd 4) without destroying the instance.
   *
   * @param {Array<Object>} [resetHistory] - Optional reset state from simulator
   */
  function reset(resetHistory, threshold) {
    if (!chartInstance) {
      return;
    }

    const history = Array.isArray(resetHistory) && resetHistory.length > 0
      ? resetHistory
      : [{ rtt: 0, cwnd: 4 }];

    chartInstance.data.labels = history.map(item => item.rtt);
    chartInstance.data.datasets[0].data = history.map(item => item.cwnd);

    if (threshold !== undefined && Number.isFinite(threshold)) {
      chartInstance.options.scales.y.suggestedMax = Math.max(14, threshold + 2);
    }

    chartInstance.update('none'); // Immediate redraw without transition animation on reset
  }

  /**
   * Returns the underlying Chart.js instance.
   * @returns {Object|null}
   */
  function getChartInstance() {
    return chartInstance;
  }

  return {
    init: init,
    update: update,
    reset: reset,
    getChartInstance: getChartInstance
  };
});
