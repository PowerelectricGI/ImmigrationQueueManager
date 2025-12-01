/**
 * src/js/ui/dashboard.js
 * 대시보드 UI 로직
 */

import { ZoneHeatmap, ZoneCardList, generateManualInputTable, generateSettingsHTML } from './components.js';
import { TimelineChart } from './chart.js';
import { SettingsUI } from './settings.js';

export class Dashboard {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.chart = null;
    this.currentView = 'arrival';
    this.currentHour = new Date().getHours();
    this.requirement = null;
    this.settingsUI = new SettingsUI(eventBus);
    this.modalChart = null;
  }

  /**
   * 대시보드 초기화
   */
  init() {
    // 차트 초기화
    this.chart = new TimelineChart('main-chart', 'arrival');
    this.departureChart = new TimelineChart('departure-chart', 'departure');

    // 네비게이션 이벤트 바인딩
    this.bindNavigation();

    // 데이터 입력 테이블 생성
    generateManualInputTable();

    console.log('Dashboard initialized');
  }

  /**
   * 네비게이션 이벤트 바인딩
   */
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        this.switchView(view);

        // 활성 상태 업데이트
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
      });
    });

    // Booth Click Delegation
    document.addEventListener('click', (e) => {
      // Booth Trigger
      const boothTarget = e.target.closest('.booth-trigger');
      if (boothTarget) {
        const type = boothTarget.dataset.type;
        const zone = boothTarget.dataset.zone;
        const booth = parseInt(boothTarget.dataset.booth);
        this.handleBoothClick(type, zone, booth);
        return;
      }

      // Zone Card Trigger
      const zoneTarget = e.target.closest('.zone-card-trigger');
      if (zoneTarget) {
        const type = zoneTarget.dataset.type;
        const zone = zoneTarget.dataset.zone;
        this.handleZoneClick(type, zone);
      }
    });

  }

  /**
   * Handle Zone Card Click
   */
  handleZoneClick(type, zoneId) {
    console.log(`Zone Clicked: ${type} - ${zoneId}`);
    if (!this.requirement || !this.requirement.hourlyRequirement) return;

    const hourlyData = this.requirement.hourlyRequirement.map(data => {
      const zoneData = type === 'arrival' ? data.arrival[zoneId] : data.departure[zoneId];
      return {
        hour: data.hour,
        hourStart: data.hourStart,
        passengers: zoneData?.passengers || 0,
        required: zoneData?.required || 0
      };
    });

    this.openZoneDetailModal(type, zoneId, hourlyData);
  }

  /**
   * Open Zone Detail Modal
   */
  openZoneDetailModal(type, zoneId, hourlyData) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const zoneLabels = type === 'arrival'
      ? { AB: 'A,B 구역', C: 'C 구역', D: 'D 구역', EF: 'E,F 구역' }
      : { AB: '1,2 구역', C: '3 구역', D: '4 구역', EF: '5,6 구역' };

    const title = `${type === 'arrival' ? '입국' : '출국'} ${zoneLabels[zoneId]} 시간대별 현황`;

    let tableRows = hourlyData.map(d => `
      <tr>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color);">${d.hour}</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: right;">${d.passengers.toLocaleString()}명</td>
        <td style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); text-align: right;">${d.required}명</td>
      </tr>
    `).join('');

    const modalHTML = `
      <div class="modal-overlay" id="zone-modal-overlay">
        <div class="modal-content" style="max-width: 600px;">
          <div class="modal-header">
            <div class="modal-title">${title}</div>
            <div class="modal-close" id="modal-close-btn">×</div>
          </div>
          <div class="modal-body" style="max-height: 80vh; overflow-y: auto;">
            <div class="chart-container" style="height: 200px; margin-bottom: 1rem;">
              <canvas id="modal-chart"></canvas>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.05);">
                  <th style="padding: 0.5rem; text-align: left;">시간</th>
                  <th style="padding: 0.5rem; text-align: right;">승객수</th>
                  <th style="padding: 0.5rem; text-align: right;">필요 인원</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    modalContainer.innerHTML = modalHTML;

    // Render Chart
    this.renderModalChart(type, hourlyData);

    // Bind Close Events
    const overlay = document.getElementById('zone-modal-overlay');
    const closeBtn = document.getElementById('modal-close-btn');

    const closeModal = () => {
      this.destroyModalChart();
      modalContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }
  }

  /**
   * Render Modal Chart
   */
  renderModalChart(type, hourlyData) {
    const canvas = document.getElementById('modal-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const labels = hourlyData.map(d => d.hour);
    const passengerData = hourlyData.map(d => d.passengers);
    const staffData = hourlyData.map(d => d.required);

    const getColor = (value) => {
      if (type === 'arrival') {
        if (value < 1000) return 'rgba(34, 197, 94, 0.8)'; // Green
        if (value < 2500) return 'rgba(234, 179, 8, 0.8)'; // Yellow
        if (value < 4000) return 'rgba(249, 115, 22, 0.8)'; // Orange
        return 'rgba(239, 68, 68, 0.8)'; // Red
      } else {
        if (value < 1000) return 'rgba(56, 189, 248, 0.8)'; // Light Blue
        if (value < 2500) return 'rgba(37, 99, 235, 0.8)'; // Blue
        if (value < 4000) return 'rgba(79, 70, 229, 0.8)'; // Indigo
        return 'rgba(147, 51, 234, 0.8)'; // Purple
      }
    };

    this.modalChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: '승객 수',
            data: passengerData,
            backgroundColor: (context) => getColor(context.raw),
            borderColor: (context) => getColor(context.raw).replace('0.8)', '1)'),
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'y',
            order: 2
          },
          {
            label: '필요 인원',
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
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(22, 27, 34, 0.95)',
            titleColor: '#e6edf3',
            bodyColor: '#8b949e',
            borderColor: '#30363d',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            displayColors: true
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(48, 54, 61, 0.3)', drawBorder: false },
            ticks: { color: '#8b949e', font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
          },
          y: {
            type: 'linear',
            position: 'left',
            beginAtZero: true,
            grid: { color: 'rgba(48, 54, 61, 0.3)', drawBorder: false },
            ticks: { color: '#8b949e', font: { size: 10 } }
          },
          y1: {
            type: 'linear',
            position: 'right',
            beginAtZero: true,
            grid: { drawOnChartArea: false },
            ticks: { color: '#fbbf24', font: { size: 10 } }
          }
        }
      }
    });
  }

  /**
   * Destroy Modal Chart
   */
  destroyModalChart() {
    if (this.modalChart) {
      this.modalChart.destroy();
      this.modalChart = null;
    }
  }

  /**
   * 뷰 전환
   */
  switchView(viewName) {
    this.currentView = viewName;

    // 모든 뷰 숨기기
    const views = document.querySelectorAll('.view-container');
    views.forEach(v => v.classList.add('hidden'));

    // 선택된 뷰 표시
    const targetView = document.getElementById(`view-${viewName}`);
    if (targetView) {
      targetView.classList.remove('hidden');
    }

    // 특정 뷰에 대한 추가 처리
    if (viewName === 'arrival') {
      console.log('Switching to Arrival view', { requirement: this.requirement });
      if (this.requirement) {
        this.renderArrivalDetail(this.requirement);
      } else {
        // Try to load from storage if missing
        const savedReq = localStorage.getItem('iqm_current_requirement');
        if (savedReq) {
          try {
            this.requirement = JSON.parse(savedReq);
            this.renderArrivalDetail(this.requirement);
          } catch (e) {
            console.error('Failed to load requirement from storage', e);
          }
        }
      }
    } else if (viewName === 'departure' && this.requirement) {
      this.renderDepartureDetail(this.requirement);
    } else if (viewName === 'settings') {
      this.renderSettingsView();
    }
  }

  /**
   * 전체 대시보드 렌더링
   */
  render(requirement) {
    if (!requirement) return;

    this.requirement = requirement;

    // Update Last Updated Time
    if (requirement.lastUpdated) {
      const date = new Date(requirement.lastUpdated);
      const options = { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
      const timeString = date.toLocaleString('ko-KR', options);
      const updateText = `마지막 업데이트: ${timeString}`;

      const arrivalTimeEl = document.getElementById('arrival-update-time');
      const departureTimeEl = document.getElementById('departure-update-time');
      const dataTimeEl = document.getElementById('data-update-time');

      if (arrivalTimeEl) arrivalTimeEl.textContent = updateText;
      if (departureTimeEl) departureTimeEl.textContent = updateText;
      if (dataTimeEl) dataTimeEl.textContent = updateText;
    }

    this.renderDateInfo(requirement);
    this.renderPeakAlert(requirement);
    this.renderChart(requirement);
    // this.renderZoneCards(requirement); // Removed as it's merged into renderArrivalDetail

    // 현재 활성화된 뷰에 따라 추가 렌더링
    if (this.currentView === 'arrival') {
      this.renderArrivalDetail(requirement);
    } else if (this.currentView === 'departure') {
      this.renderDepartureDetail(requirement);
    }
  }

  /**
   * 날짜 정보 렌더링
   */
  renderDateInfo(requirement) {
    const dateText = document.getElementById('current-date');
    const terminalInfo = document.getElementById('terminal-info');
    const dateTextDep = document.getElementById('current-date-dep');
    const terminalInfoDep = document.getElementById('terminal-info-dep');

    // Chart Title Dates
    const chartDateArrival = document.getElementById('chart-date-arrival');
    const chartDateDeparture = document.getElementById('chart-date-departure');

    if (requirement.date) {
      const date = new Date(requirement.date);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[date.getDay()];
      const text = `${requirement.date} (${dayName})`;
      const simpleDate = requirement.date; // e.g. 2025.12.01

      if (dateText) dateText.textContent = text;
      if (dateTextDep) dateTextDep.textContent = text;

      if (chartDateArrival) chartDateArrival.textContent = simpleDate;
      if (chartDateDeparture) chartDateDeparture.textContent = simpleDate;
    }

    if (terminalInfo) terminalInfo.textContent = '제1여객터미널';
    if (terminalInfoDep) terminalInfoDep.textContent = '제1여객터미널';
  }

  /**
   * 피크 시간 알림 렌더링
   */
  renderPeakAlert(requirement) {
    const { summary } = requirement;
    if (!summary) return;

    const updateAlert = (suffix = '') => {
      const peakTime = document.getElementById(`peak-time${suffix}`);
      const peakArrivalPax = document.getElementById(`peak-arrival-pax${suffix}`);
      const peakArrivalStaff = document.getElementById(`peak-arrival-staff${suffix}`);
      const peakDeparturePax = document.getElementById(`peak-departure-pax${suffix}`);
      const peakDepartureStaff = document.getElementById(`peak-departure-staff${suffix}`);

      if (peakTime) {
        peakTime.textContent = `${summary.peakHour || '08:00'} 피크 예상`;
      }

      // 피크 시간대 데이터 찾기
      const peakHourStart = parseInt(summary.peakHour?.split(':')[0] || summary.peakHour?.split('~')[0]) || 8;
      const peakData = requirement.hourlyRequirement.find(d => d.hourStart === peakHourStart);

      if (peakData) {
        const arrTotal = Object.values(peakData.arrival).reduce((sum, z) => sum + (z.passengers || 0), 0);
        const depTotal = Object.values(peakData.departure).reduce((sum, z) => sum + (z.passengers || 0), 0);

        if (peakArrivalPax) peakArrivalPax.textContent = arrTotal.toLocaleString();
        if (peakArrivalStaff) peakArrivalStaff.textContent = `${peakData.totalArrival}명`;
        if (peakDeparturePax) peakDeparturePax.textContent = depTotal.toLocaleString();
        if (peakDepartureStaff) peakDepartureStaff.textContent = `${peakData.totalDeparture}명`;
      }
    };

    updateAlert();       // Arrival Tab
    updateAlert('-dep'); // Departure Tab
  }

  /**
   * 차트 렌더링
   */
  renderChart(requirement) {
    if (requirement.hourlyRequirement) {
      if (this.chart) this.chart.update(requirement.hourlyRequirement);
      if (this.departureChart) this.departureChart.update(requirement.hourlyRequirement);
    }
  }

  /**
   * 구역 카드 렌더링 (현재 시간대) - Deprecated/Merged
   */
  renderZoneCards(requirement) {
    // Merged into renderArrivalDetail
  }

  /**
   * 입국 상세 뷰 렌더링
   */
  renderArrivalDetail(requirement) {
    const hourDisplay = document.getElementById('arrival-hour-display'); // Note: This ID might need to be added back if we want hour display
    const zoneList = document.getElementById('arrival-zone-list');
    const totalDiv = document.getElementById('arrival-total');

    const currentData = requirement.hourlyRequirement.find(d => d.hourStart === this.currentHour)
      || requirement.hourlyRequirement[0];

    if (!currentData) {
      console.warn('renderArrivalDetail: No currentData found');
      return;
    }

    const assignmentContainer = document.getElementById('arrival-booth-container');
    if (!assignmentContainer) {
      console.error('CRITICAL: arrival-booth-container NOT FOUND in DOM');
      return;
    }

    const hourEnd = (currentData.hourStart + 1) % 24;
    if (hourDisplay) {
      hourDisplay.textContent = `${String(currentData.hourStart).padStart(2, '0')}:00 ~ ${String(hourEnd).padStart(2, '0')}:00`;
    }

    if (zoneList) {
      const headerHtml = `<div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem; text-align: left;">현재 시간 승객수 (클릭하면 전체 시간)</div>`;
      zoneList.innerHTML = headerHtml + ZoneCardList(currentData.arrival, 'arrival');
    }

    if (assignmentContainer) {
      // Generate all HTML string first
      const zones = ['AB', 'C', 'D', 'EF'];
      const zoneLabels = { AB: 'A,B 구역', C: 'C 구역', D: 'D 구역', EF: 'E,F 구역' };

      let fullHtml = '';

      zones.forEach(zone => {
        // Generate Booth Grid HTML directly here
        const boothCount = 10;
        let gridHtml = `<div class="booth-assignment-section" style="margin-top: 1rem; background: var(--color-bg-card); padding: 1rem; border-radius: var(--radius-md);">`;
        gridHtml += `<div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">부스 배정 (${zoneLabels[zone]})</div>`;
        gridHtml += `<div class="booth-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;">`;

        for (let i = 1; i <= boothCount; i++) {
          const assignedStaff = this.staffList?.find(s =>
            s.assignment &&
            s.assignment.type === 'arrival' &&
            s.assignment.zone === zone &&
            s.assignment.booth === i
          );

          const isAssigned = !!assignedStaff;
          const statusColor = isAssigned ? 'var(--color-success)' : 'var(--color-text-muted)';
          const statusText = isAssigned ? assignedStaff.name : '빈 부스';
          const opacity = isAssigned ? '1' : '0.5';

          gridHtml += `
                <div class="booth-item booth-trigger" data-type="arrival" data-zone="${zone}" data-booth="${i}" style="cursor: pointer; text-align: center; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: rgba(255,255,255,0.02);">
                  <div style="font-size: 1.5rem; margin-bottom: 0.2rem; opacity: ${opacity}; pointer-events: none;">🛂</div>
                  <div style="font-size: 0.8rem; font-weight: bold; color: ${statusColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${statusText}</div>
                  <div style="font-size: 0.7rem; color: var(--color-text-muted); pointer-events: none;">부스 ${i}</div>
                </div>
              `;
        }
        gridHtml += `</div></div>`;
        fullHtml += gridHtml;
      });

      assignmentContainer.innerHTML = fullHtml;
    } else {
      console.error('CRITICAL ERROR: arrival-booth-container NOT FOUND');
    }

    if (totalDiv) {
      const arrTotal = Object.values(currentData.arrival).reduce((sum, z) => sum + (z.passengers || 0), 0);
      totalDiv.innerHTML = `
        <span class="zone-total-text">합계: <span class="pax">${arrTotal.toLocaleString()}</span>명 / <span class="staff">${currentData.totalArrival}명</span> 필요</span>
      `;
    }
  }

  /**
   * 출국 상세 뷰 렌더링
   */
  renderDepartureDetail(requirement) {
    const hourDisplay = document.getElementById('departure-hour-display');
    const zoneList = document.getElementById('departure-zone-list');
    const totalDiv = document.getElementById('departure-total');

    const currentData = requirement.hourlyRequirement.find(d => d.hourStart === this.currentHour)
      || requirement.hourlyRequirement[0];

    if (!currentData) return;

    const hourEnd = (currentData.hourStart + 1) % 24;
    if (hourDisplay) {
      hourDisplay.textContent = `${String(currentData.hourStart).padStart(2, '0')}:00 ~ ${String(hourEnd).padStart(2, '0')}:00`;
    }

    if (zoneList) {
      const headerHtml = `<div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem; text-align: left;">현재 시간 승객수 (클릭하면 전체 시간)</div>`;
      zoneList.innerHTML = headerHtml + ZoneCardList(currentData.departure, 'departure');

      // Add Booth Assignment Containers
      const zones = ['AB', 'C', 'D', 'EF'];
      const zoneLabels = { AB: '1,2 구역', C: '3 구역', D: '4 구역', EF: '5,6 구역' }; // Updated keys

      let assignmentHtml = '';
      zones.forEach(zone => {
        assignmentHtml += `<div id="booth-assign-departure-${zone}"></div>`;
      });

      zoneList.innerHTML += assignmentHtml;

      // Now render the actual booth UIs
      zones.forEach(zone => {
        this.renderBoothAssignment(`booth-assign-departure-${zone}`, 'departure', zoneLabels[zone]);
      });
    }

    if (totalDiv) {
      const depTotal = Object.values(currentData.departure).reduce((sum, z) => sum + (z.passengers || 0), 0);
      totalDiv.innerHTML = `
        <span class="zone-total-text">합계: <span class="pax">${depTotal.toLocaleString()}</span>명 / <span class="staff">${currentData.totalDeparture}명</span> 필요</span>
      `;
    }
  }

  /**
   * 설정 뷰 렌더링
   */
  renderSettingsView() {
    const settingsView = document.getElementById('view-settings');
    if (!settingsView) return;

    // 현재 설정 가져오기 (app에서 전달받아야 함)
    const settings = window.iqmApp?.state?.settings || {};

    settingsView.innerHTML = `
      <div style="padding: var(--spacing-md);">
        ${generateSettingsHTML(settings)}
      </div>
    `;

    // 슬라이더 이벤트 바인딩
    this.bindSettingsEvents();
  }

  /**
   * 설정 이벤트 바인딩
   */
  bindSettingsEvents() {
    const sliderPairs = [
      { slider: 'setting-arr-korean', display: 'val-arr-korean', suffix: '명/시간' },
      { slider: 'setting-arr-foreign', display: 'val-arr-foreign', suffix: '명/시간' },
      { slider: 'setting-wait-time', display: 'val-wait-time', suffix: '분' },
      { slider: 'setting-utilization', display: 'val-utilization', suffix: '%' },
      { slider: 'setting-autogate', display: 'val-autogate', suffix: '%' }
    ];

    sliderPairs.forEach(pair => {
      const slider = document.getElementById(pair.slider);
      const display = document.getElementById(pair.display);

      if (slider && display) {
        slider.addEventListener('input', () => {
          display.textContent = slider.value + pair.suffix;
        });
      }
    });

    // 다크모드 토글
    const darkModeToggle = document.getElementById('setting-darkmode');
    if (darkModeToggle) {
      darkModeToggle.addEventListener('change', () => {
        const theme = darkModeToggle.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', theme);
      });
    }

    // 저장 버튼
    const saveBtn = document.getElementById('btn-save-settings');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.settingsUI.saveFromView();
        alert('설정이 저장되었습니다.');
      });
    }
  }
  /**
   * 수동 입력 테이블 업데이트
   */
  updateManualInputTable(requirement) {
    if (!requirement || !requirement.hourlyRequirement) return;

    const tbody = document.getElementById('manual-input-body');
    if (!tbody || tbody.children.length === 0) {
      generateManualInputTable();
    }

    requirement.hourlyRequirement.forEach(data => {
      const hour = data.hourStart;
      const arrInput = document.getElementById(`arr-${hour}`);
      const depInput = document.getElementById(`dep-${hour}`);

      if (arrInput && depInput) {
        // Use explicit totals from calculator (which prefers source total)
        arrInput.value = data.arrivalPassengers || 0;
        depInput.value = data.departurePassengers || 0;
      }
    });
  }

  /**
   * Staff List Update
   */
  updateStaffList(staffList) {
    this.staffList = staffList;
    // Re-render current view to reflect staff changes
    if (this.currentView === 'arrival' && this.requirement) {
      this.renderArrivalDetail(this.requirement);
    } else if (this.currentView === 'departure' && this.requirement) {
      this.renderDepartureDetail(this.requirement);
    }
  }

  /**
   * Render Booth Assignment Section
   */
  renderBoothAssignment(containerId, type, zone) {
    const container = document.getElementById(containerId);
    console.log(`renderBoothAssignment: ${containerId}, type=${type}, zone=${zone}, container=${!!container}`);
    if (!container) return;

    const boothCount = 10; // Fixed 10 booths
    let html = `<div class="booth-assignment-section" style="margin-top: 1rem; background: var(--color-bg-card); padding: 1rem; border-radius: var(--radius-md);">`;
    html += `<div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">부스 배정 (${zone})</div>`;
    html += `<div class="booth-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem;">`;

    for (let i = 1; i <= boothCount; i++) {
      // Find staff assigned to this booth
      const assignedStaff = this.staffList?.find(s =>
        s.assignment &&
        s.assignment.type === type &&
        s.assignment.zone === zone &&
        s.assignment.booth === i
      );

      const isAssigned = !!assignedStaff;
      const statusColor = isAssigned ? 'var(--color-success)' : 'var(--color-text-muted)';
      const statusText = isAssigned ? assignedStaff.name : '빈 부스';
      const opacity = isAssigned ? '1' : '0.5';

      html += `
        <div class="booth-item booth-trigger" data-type="${type}" data-zone="${zone}" data-booth="${i}" style="cursor: pointer; text-align: center; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: var(--radius-sm); background: rgba(255,255,255,0.02);">
          <div style="font-size: 1.5rem; margin-bottom: 0.2rem; opacity: ${opacity}; pointer-events: none;">🛂</div>
          <div style="font-size: 0.8rem; font-weight: bold; color: ${statusColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none;">${statusText}</div>
          <div style="font-size: 0.7rem; color: var(--color-text-muted); pointer-events: none;">부스 ${i}</div>
        </div>
      `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }

  /**
   * Handle Booth Click (Global handler needed or bind in render)
   * Since we use onclick string, we need a global handler.
   * Better to delegate or bind.
   * For now, let's attach a global handler in init or constructor.
   */
  /**
   * Handle Booth Click
   */
  /**
   * Handle Booth Click
   */
  handleBoothClick(type, zone, booth) {
    // Open Modal for assignment/management regardless of status
    this.openStaffSelectionModal(type, zone, booth);
  }

  /**
   * Open Staff Selection Modal
   */
  openStaffSelectionModal(type, zone, booth) {
    const app = window.iqmApp;
    if (!app) return;

    const currentStaffList = app.state.staffList || [];
    const idleStaff = currentStaffList.filter(s => s.status === 'idle');

    // Find currently assigned staff
    const assignedStaff = currentStaffList.find(s =>
      s.assignment &&
      s.assignment.type === type &&
      s.assignment.zone === zone &&
      s.assignment.booth === booth
    );

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    let modalBodyHTML = '';

    // If assigned, show current staff and unassign option
    if (assignedStaff) {
      modalBodyHTML += `
            <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: var(--radius-sm);">
                <div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">현재 담당자</div>
                <div style="font-size: 1.2rem; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                    <span>${assignedStaff.name}</span>
                    <button id="btn-unassign-staff" data-id="${assignedStaff.id}" style="cursor: pointer; font-size: 0.9rem; background: transparent; color: var(--color-alert-red); border: 1px solid var(--color-alert-red); padding: 0.4rem 1rem; border-radius: var(--radius-sm); transition: all 0.2s;">배정 해제</button>
                </div>
            </div>
            <div style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 0.5rem;">교체 대상...</div>
        `;
    }

    if (idleStaff.length === 0) {
      modalBodyHTML += '<div style="text-align: center; color: var(--color-text-muted); padding: 2rem;">대기 중인 직원이 없습니다.</div>';
    } else {
      modalBodyHTML += `<div class="staff-selection-list">
            ${idleStaff.map(staff => `
              <button class="staff-select-btn" data-id="${staff.id}">
                <span>${staff.name}</span>
                <span class="status-badge">대기</span>
              </button>
            `).join('')}
        </div>`;
    }

    const modalHTML = `
      <div class="modal-overlay" id="staff-modal-overlay">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title">부스 ${booth} 관리 (${zone})</div>
            <div class="modal-close" id="modal-close-btn">×</div>
          </div>
          <div class="modal-body">
            ${modalBodyHTML}
          </div>
        </div>
      </div>
    `;

    modalContainer.innerHTML = modalHTML;

    // Bind Events
    const overlay = document.getElementById('staff-modal-overlay');
    const closeBtn = document.getElementById('modal-close-btn');
    const unassignBtn = document.getElementById('btn-unassign-staff');

    const closeModal = () => {
      modalContainer.innerHTML = '';
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Unassign Event
    if (unassignBtn) {
      unassignBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Direct unassign without native confirm (can be improved with custom UI later)
        if (assignedStaff && assignedStaff.id) {
          this.eventBus.emit('staff:unassign', { staffId: assignedStaff.id });
          closeModal();
        } else {
          console.error('No staff ID found for unassignment');
        }
      });
    }

    // Staff Selection Events (Assignment/Replacement)
    const staffBtns = modalContainer.querySelectorAll('.staff-select-btn');
    staffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const staffId = btn.dataset.id;
        // If replacing, we might want to unassign the old one first, 
        // but our app.js logic might handle it or we can just overwrite.
        // Ideally, the backend/logic handles "if booth occupied, unassign old, assign new".
        // For now, let's just emit assign. If the system supports overwriting, it works.
        // If not, we might need to emit unassign for old one first.
        // Let's assume overwrite is fine or add unassign logic here if needed.

        if (assignedStaff) {
          // Optional: Explicitly unassign old staff to set them to IDLE
          app.eventBus.emit('staff:unassign', { staffId: assignedStaff.id });
        }

        app.eventBus.emit('staff:assign', {
          staffId: staffId,
          type: type,
          zone: zone,
          booth: booth
        });
        closeModal();
      });
    });
  }
}
