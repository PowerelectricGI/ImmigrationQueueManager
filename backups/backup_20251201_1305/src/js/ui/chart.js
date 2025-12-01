/**
 * src/js/ui/chart.js
 * Chart.js 래퍼
 */

export class TimelineChart {
  constructor(canvasId, type = 'arrival') {
    this.canvasId = canvasId;
    this.type = type;
    this.chart = null;
    console.log(`Chart.js loaded for ${type}`);
    this.init();
  }

  init() {
    const canvas = document.getElementById(this.canvasId);
    if (!canvas) {
      console.warn(`Canvas element '${this.canvasId}' not found`);
      return;
    }

    const ctx = canvas.getContext('2d');

    // Chart.js 기본 설정
    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: []
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(22, 27, 34, 0.95)',
            titleColor: '#e6edf3',
            bodyColor: '#8b949e',
            borderColor: '#30363d',
            borderWidth: 1,
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            callbacks: {
              label: function (context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  if (context.dataset.yAxisID === 'y1') {
                    label += context.parsed.y + ' staff';
                  } else {
                    label += context.parsed.y.toLocaleString() + ' pax';
                  }
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(48, 54, 61, 0.5)',
              drawBorder: false
            },
            ticks: {
              color: '#8b949e',
              font: {
                size: 10
              },
              maxRotation: 0,
              callback: function (value, index) {
                // 3시간마다 레이블 표시
                return index % 3 === 0 ? this.getLabelForValue(value) : '';
              }
            }
          },
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: {
              color: 'rgba(48, 54, 61, 0.5)',
              drawBorder: false
            },
            ticks: {
              color: '#8b949e',
              font: {
                size: 10
              },
              callback: function (value) {
                if (value >= 1000) {
                  return (value / 1000) + 'k';
                }
                return value;
              }
            }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              color: '#fbbf24',
              font: {
                size: 10
              }
            }
          }
        }
      }
    });
  }

  /**
   * 차트 데이터 업데이트
   * @param {Array} hourlyData - 시간대별 데이터
   */
  update(hourlyData) {
    if (!this.chart || !hourlyData) return;

    const labels = hourlyData.map(d => {
      // Backend returns "hour": "00~01" or similar
      return d.hour || d.hourStart || '';
    });

    // 승객 데이터 추출 (Type에 따라 분기)
    const passengerData = hourlyData.map(d => {
      const dataObj = this.type === 'arrival' ? d.arrival : d.departure;

      if (dataObj && typeof dataObj === 'object') {
        // Data is transformed by calculator.js, so values are objects with 'passengers' property
        return Object.values(dataObj).reduce((sum, zone) => {
          return sum + (zone.passengers || 0);
        }, 0);
      }
      return 0;
    });

    // 필요 인원 데이터
    const staffData = hourlyData.map(d => {
      return this.type === 'arrival' ? (d.totalArrival || 0) : (d.totalDeparture || 0);
    });

    // Color gradient helper
    const getColor = (value) => {
      if (this.type === 'arrival') {
        if (value < 1000) return 'rgba(34, 197, 94, 0.8)'; // Green
        if (value < 2500) return 'rgba(234, 179, 8, 0.8)'; // Yellow
        if (value < 4000) return 'rgba(249, 115, 22, 0.8)'; // Orange
        return 'rgba(239, 68, 68, 0.8)'; // Red
      } else {
        // Departure Colors (Blue/Purple)
        if (value < 1000) return 'rgba(56, 189, 248, 0.8)'; // Light Blue
        if (value < 2500) return 'rgba(37, 99, 235, 0.8)'; // Blue
        if (value < 4000) return 'rgba(79, 70, 229, 0.8)'; // Indigo
        return 'rgba(147, 51, 234, 0.8)'; // Purple
      }
    };

    this.chart.data.labels = labels;
    this.chart.data.datasets = [
      {
        label: this.type === 'arrival' ? 'Arrival Pax' : 'Departure Pax',
        data: passengerData,
        backgroundColor: (context) => {
          const value = context.raw;
          return getColor(value);
        },
        borderColor: (context) => {
          const value = context.raw;
          return getColor(value).replace('0.8)', '1)');
        },
        borderWidth: 1,
        borderRadius: 4,
        yAxisID: 'y',
        order: 2
      },
      {
        label: 'Required Staff',
        data: staffData,
        type: 'line',
        borderColor: '#fbbf24',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.3,
        yAxisID: 'y1',
        order: 1
      }
    ];

    this.chart.update('none');
  }

  /**
   * 특정 시간대 하이라이트
   */
  highlightHour(hourIndex) {
    if (!this.chart) return;
    // 향후 구현: 특정 막대 강조 표시
  }

  /**
   * 차트 파괴
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
