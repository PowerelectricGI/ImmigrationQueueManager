/**
 * src/js/app.js
 * 메인 애플리케이션 진입점
 */
console.log('App.js loaded');

import { DefaultSettings, STORAGE_KEYS } from './config.js';
import { Storage } from './data/storage.js';
import { AirportDataImporter } from './data/importer.js';
import { SampleForecast } from './data/sampleData.js';
import { calculateAllRequirements } from './core/calculator.js';
import { Dashboard } from './ui/dashboard.js';
import { StaffUI } from './ui/staff.js';
import { ParkingUI } from './ui/parking.js';
import { ParkingDataFetcher } from './data/parkingFetch.js';

// --- EventBus Implementation ---
class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// --- Main App Class ---
class App {
  constructor() {
    this.eventBus = new EventBus();
    this.dashboard = new Dashboard(this.eventBus);
    this.staffUI = new StaffUI(this.eventBus);
    this.parkingUI = new ParkingUI(this.eventBus);

    this.state = {
      settings: DefaultSettings,
      forecast: null,
      requirement: null,
      staffList: [],
      parkingData: null
    };

    window.iqmApp = this;
  }

  async init() {
    try {
      console.log('IQM App Initializing...');

      // 1. 설정 로드 (Local + Remote)
      const localSettings = Storage.load(STORAGE_KEYS.SETTINGS);
      if (localSettings) {
        this.state.settings = { ...DefaultSettings, ...localSettings };
      }

      // Supabase 최신 설정 가져오기
      Storage.fetchLatest(STORAGE_KEYS.SETTINGS).then(remoteSettings => {
        if (remoteSettings) {
          console.log('Remote settings loaded');
          this.state.settings = { ...DefaultSettings, ...remoteSettings };
          // Do NOT emit 'settings:changed' here to avoid auto-saving back to server
          // Just update local state and UI
          if (this.state.forecast) {
            this.recalculate();
          }
        }
      });

      // 테마 적용
      document.documentElement.setAttribute('data-theme', this.state.settings.theme || 'dark');

      // 2. UI 초기화
      this.dashboard.init();

      // 3. 이벤트 바인딩
      this.bindEvents();

      // 4. 데이터 로드
      const savedForecast = Storage.load(STORAGE_KEYS.CURRENT_FORECAST);
      if (savedForecast) {
        console.log('Loaded saved forecast');
        this.updateForecast(savedForecast);
      } else {
        console.log('Loading sample data');
        this.updateForecast(SampleForecast);
      }

      // 5. 직원 데이터 로드 (Local + Remote)
      const localStaff = Storage.load(STORAGE_KEYS.STAFF);
      if (localStaff && Array.isArray(localStaff)) {
        this.state.staffList = localStaff;
        this.staffUI.setStaffList(localStaff);
        this.dashboard.updateStaffList(localStaff);
      }

      // Supabase 최신 직원 목록 가져오기
      Storage.fetchLatest(STORAGE_KEYS.STAFF).then(remoteStaff => {
        if (remoteStaff && Array.isArray(remoteStaff)) {
          console.log('Remote staff list loaded', remoteStaff.length);
          this.state.staffList = remoteStaff;
          this.staffUI.setStaffList(remoteStaff);
          this.dashboard.updateStaffList(remoteStaff);
          // LocalStorage 동기화 (Cloud Save 호출 없이 로컬만 업데이트)
          localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(remoteStaff));
        }
      });

      // 6. 실시간 구독 시작
      const statusIndicator = document.createElement('div');
      statusIndicator.id = 'sync-status';
      statusIndicator.style.cssText = 'position: fixed; bottom: 70px; right: 10px; padding: 5px 10px; background: rgba(0,0,0,0.7); color: white; border-radius: 20px; font-size: 12px; z-index: 9999; display: flex; align-items: center; gap: 5px;';
      statusIndicator.innerHTML = '<span style="width: 8px; height: 8px; background: #fbbf24; border-radius: 50%;"></span> Connecting...';
      document.body.appendChild(statusIndicator);

      const updateStatus = (status) => {
        const dot = statusIndicator.querySelector('span');
        if (status === 'SUBSCRIBED') {
          dot.style.background = '#10b981'; // Green
          statusIndicator.innerHTML = '<span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span> Cloud Active';
        } else if (status === 'DISCONNECTED' || status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          dot.style.background = '#ef4444'; // Red
          statusIndicator.innerHTML = `<span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span> ${status}`;
        } else {
          statusIndicator.innerHTML = `<span style="width: 8px; height: 8px; background: #fbbf24; border-radius: 50%;"></span> ${status}`;
        }
      };

      Storage.subscribe(
        (updatedStaffList) => {
          console.log('Realtime update: Staff list');
          this.state.staffList = updatedStaffList;
          this.staffUI.setStaffList(updatedStaffList);
          this.dashboard.updateStaffList(updatedStaffList);
          localStorage.setItem(STORAGE_KEYS.STAFF, JSON.stringify(updatedStaffList));

          // Flash indicator
          const originalText = statusIndicator.innerHTML;
          statusIndicator.innerHTML = '<span style="width: 8px; height: 8px; background: #3b82f6; border-radius: 50%;"></span> Syncing...';
          setTimeout(() => { statusIndicator.innerHTML = originalText; }, 1000);
        },
        (updatedSettings) => {
          console.log('Realtime update: Settings');
          this.state.settings = updatedSettings;
          this.eventBus.emit('settings:changed', updatedSettings);
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
        },
        (status) => {
          console.log('Subscription Status:', status);
          updateStatus(status);
        }
      );

      console.log('App initialized successfully');
    } catch (err) {
      console.error('App initialization failed:', err);
    }
  }

  bindEvents() {
    // 설정 버튼
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.dashboard.switchView('settings');
        // 네비게이션 활성화 업데이트
        document.querySelectorAll('.nav-item').forEach(nav => {
          nav.classList.toggle('active', nav.dataset.view === 'settings');
        });
      });
    }

    // Staff Updates (New)
    this.eventBus.on('staff:updated', (updatedList) => {
      this.state.staffList = updatedList;
      Storage.save(STORAGE_KEYS.STAFF, updatedList);
      this.staffUI.setStaffList(updatedList);
      // Also update dashboard if needed (for assignment dropdowns)
      this.dashboard.updateStaffList(updatedList);
    });

    // Staff Assignment from Dashboard (New)
    this.eventBus.on('staff:assign', ({ staffId, type, zone, booth }) => {
      const staffIndex = this.state.staffList.findIndex(s => s.id === staffId);
      if (staffIndex !== -1) {
        // Clear previous assignment if any
        // const oldAssignment = this.state.staffList[staffIndex].assignment; // Not used in this snippet

        // Update staff status
        this.state.staffList[staffIndex].status = 'assigned';
        this.state.staffList[staffIndex].assignment = { type, zone, booth };

        // If staff was assigned elsewhere, we might need to clear that booth?
        // For now, assume UI handles "stealing" or we just update the record.

        Storage.save(STORAGE_KEYS.STAFF, this.state.staffList);
        this.staffUI.setStaffList(this.state.staffList);
        this.dashboard.updateStaffList(this.state.staffList);
      }
    });

    this.eventBus.on('staff:unassign', ({ staffId }) => {
      const staffIndex = this.state.staffList.findIndex(s => s.id === staffId);
      if (staffIndex !== -1) {
        this.state.staffList[staffIndex].status = 'idle';
        this.state.staffList[staffIndex].assignment = null;

        Storage.save(STORAGE_KEYS.STAFF, this.state.staffList);
        this.staffUI.setStaffList(this.state.staffList);
        this.dashboard.updateStaffList(this.state.staffList);
      }
    });

    // Staff Save (New)
    this.eventBus.on('staff:save', () => {
      if (Storage.save(STORAGE_KEYS.STAFF, this.state.staffList)) {
        alert('직원 및 배정 데이터가 저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    });

    // Staff Reset (New)
    this.eventBus.on('staff:reset', () => {
      this.state.staffList = [];
      Storage.remove(STORAGE_KEYS.STAFF);
      this.staffUI.setStaffList([]);
      this.dashboard.updateStaffList([]);
      alert('모든 직원 및 배정 데이터가 초기화되었습니다.');
    });

    // 파일 업로드
    const fileInput = document.getElementById('csv-upload');
    const uploadBtn = document.getElementById('btn-upload-file');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => {
        fileInput.click();
      });

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const forecast = await AirportDataImporter.importFromFile(file);

          // 먼저 뷰를 전환한 후 데이터 업데이트 (렌더링 순서 보장)
          this.dashboard.switchView('arrival');
          this.updateActiveNav('arrival');
          this.updateForecast(forecast);

          alert('데이터를 성공적으로 불러왔습니다.');
        } catch (error) {
          console.error(error);
          alert(`데이터 불러오기 실패: ${error.message}`);
        }
        e.target.value = '';
      });
    }

    // Date Picker Initialization
    const dateInput = document.getElementById('fetch-date');
    if (dateInput) {
      const today = new Date();
      const maxDate = new Date();
      maxDate.setDate(today.getDate() + 2); // +2 days

      // Use local time for YYYY-MM-DD format
      const formatDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      dateInput.value = formatDate(today);
      dateInput.min = formatDate(today);
      dateInput.max = formatDate(maxDate);
    }

    // API 데이터 가져오기 버튼
    const fetchBtn = document.getElementById('btn-fetch-api');
    if (fetchBtn) {
      fetchBtn.addEventListener('click', async () => {
        try {
          const originalText = fetchBtn.innerHTML;
          fetchBtn.disabled = true;
          fetchBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Loading...</span>';

          let selectedDate = null;
          if (dateInput) {
            selectedDate = dateInput.value.replace(/-/g, ''); // YYYYMMDD format
          }

          const forecast = await AirportDataImporter.fetchFromApi(selectedDate);

          // 먼저 뷰를 전환한 후 데이터 업데이트 (렌더링 순서 보장)
          this.dashboard.switchView('arrival');
          this.updateActiveNav('arrival');
          this.updateForecast(forecast);

          alert('인천공항 실시간 데이터를 성공적으로 가져왔습니다.');
        } catch (error) {
          console.error(error);
          alert(`데이터 가져오기 실패: ${error.message}\n서버가 실행 중인지 확인해주세요.`);
        } finally {
          fetchBtn.disabled = false;
          fetchBtn.innerHTML = '<span class="btn-icon">🔄</span><span>Fetch Live Data</span>';
        }
      });
    }

    // 샘플 데이터 버튼
    const sampleBtn = document.getElementById('btn-sample-data');
    if (sampleBtn) {
      sampleBtn.addEventListener('click', () => {
        // 먼저 뷰를 전환한 후 데이터 업데이트 (렌더링 순서 보장)
        this.dashboard.switchView('arrival');
        this.updateActiveNav('arrival');
        this.updateForecast(SampleForecast);
        alert('샘플 데이터가 로드되었습니다.');
      });
    }

    // 데이터 저장 버튼
    const saveBtn = document.getElementById('btn-save-data');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.saveManualInput();
      });
    }

    // EventBus 구독
    this.eventBus.on('settings:changed', (newSettings) => {
      this.state.settings = newSettings;
      Storage.save(STORAGE_KEYS.SETTINGS, newSettings);

      if (this.state.forecast) {
        this.recalculate();
      }
    });

    // 주차장 데이터 가져오기 버튼
    const parkingFetchBtn = document.getElementById('btn-fetch-parking');
    if (parkingFetchBtn) {
      parkingFetchBtn.addEventListener('click', async () => {
        try {
          parkingFetchBtn.disabled = true;
          parkingFetchBtn.innerHTML = '<span class="btn-icon">⏳</span><span>Loading...</span>';

          const parkingData = await ParkingDataFetcher.fetchParkingData();
          this.state.parkingData = parkingData;
          this.parkingUI.setData(parkingData);

          if (parkingData.errors && parkingData.errors.length > 0) {
            alert(`주차장 데이터를 가져왔습니다.\n일부 오류: ${parkingData.errors.join(', ')}`);
          } else {
            alert('주차장 현황을 성공적으로 가져왔습니다.');
          }
        } catch (error) {
          console.error('주차장 데이터 가져오기 실패:', error);
          alert(`주차장 데이터 가져오기 실패: ${error.message}`);
        } finally {
          parkingFetchBtn.disabled = false;
          parkingFetchBtn.innerHTML = '<span class="btn-icon">🔄</span><span>주차장 현황 가져오기</span>';
        }
      });
    }

    // 주차장 샘플 데이터 버튼
    const parkingSampleBtn = document.getElementById('btn-parking-sample');
    if (parkingSampleBtn) {
      parkingSampleBtn.addEventListener('click', () => {
        const sampleData = ParkingDataFetcher.getSampleData();
        this.state.parkingData = sampleData;
        this.parkingUI.setData(sampleData);
        alert('주차장 샘플 데이터가 로드되었습니다.');
      });
    }
  }

  /**
   * 수동 입력 데이터 저장
   */
  saveManualInput() {
    const hourlyData = [];

    for (let i = 0; i < 24; i++) {
      const arrInput = document.getElementById(`arr-${i}`);
      const depInput = document.getElementById(`dep-${i}`);

      const arrTotal = parseInt(arrInput?.value) || 0;
      const depTotal = parseInt(depInput?.value) || 0;

      // 간단히 균등 분배 (실제로는 더 정교한 분배 필요)
      const arrPerZone = Math.round(arrTotal / 4);
      const depPerZone = Math.round(depTotal / 4);

      hourlyData.push({
        hour: `${String(i).padStart(2, '0')}~${String(i + 1).padStart(2, '0')}`,
        hourStart: i,
        arrival: {
          AB: arrPerZone,
          C: arrPerZone,
          D: arrPerZone,
          EF: arrTotal - (arrPerZone * 3),
          total: arrTotal
        },
        departure: {
          AB: depPerZone,
          C: depPerZone,
          D: depPerZone,
          EF: depTotal - (depPerZone * 3),
          total: depTotal
        }
      });
    }

    const forecast = {
      id: this.generateUUID(),
      date: new Date().toISOString().split('T')[0],
      terminal: 'T1',
      lastUpdated: new Date().toISOString(),
      source: 'manual',
      hourlyData
    };

    // 먼저 뷰를 전환한 후 데이터 업데이트 (렌더링 순서 보장)
    this.dashboard.switchView('arrival');
    this.updateActiveNav('arrival');
    this.updateForecast(forecast);

    alert('데이터가 저장되었습니다.');
  }

  updateForecast(forecast) {
    this.state.forecast = forecast;
    Storage.save(STORAGE_KEYS.CURRENT_FORECAST, forecast);

    // Sync date picker with forecast date
    const dateInput = document.getElementById('fetch-date');
    if (dateInput && forecast.date) {
      dateInput.value = forecast.date;
    }

    this.recalculate();
  }

  recalculate() {
    if (!this.state.forecast) return;

    console.log('Calculating requirements...');
    const requirement = calculateAllRequirements(this.state.forecast, this.state.settings);
    this.state.requirement = requirement;

    Storage.save(STORAGE_KEYS.CURRENT_REQUIREMENT, requirement);
    this.dashboard.render(requirement);
    this.dashboard.updateManualInputTable(requirement);
  }

  updateActiveNav(viewName) {
    document.querySelectorAll('.nav-item').forEach(nav => {
      nav.classList.toggle('active', nav.dataset.view === viewName);
    });
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// --- Bootstrap ---
const app = new App();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// 전역 접근 (디버깅용)
window.iqmApp = app;
