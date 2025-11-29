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
      const target = e.target.closest('.booth-trigger');
      if (target) {
        const type = target.dataset.type;
        const zone = target.dataset.zone;
        const booth = parseInt(target.dataset.booth);
        this.handleBoothClick(type, zone, booth);
      }
    });

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

    if (dateText || dateTextDep) {
      const date = new Date(requirement.date);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      const dayName = days[date.getDay()];
      const text = `${requirement.date} (${dayName})`;

      if (dateText) dateText.textContent = text;
      if (dateTextDep) dateTextDep.textContent = text;
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
      zoneList.innerHTML = ZoneCardList(currentData.arrival, 'arrival');
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
      zoneList.innerHTML = ZoneCardList(currentData.departure, 'departure');

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
