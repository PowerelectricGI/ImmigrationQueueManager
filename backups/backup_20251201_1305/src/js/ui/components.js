/**
 * src/js/ui/components.js
 * 재사용 가능한 UI 컴포넌트
 */

/**
 * 구역 카드 컴포넌트 (이미지 디자인 기반)
 */
export function ZoneCard({ zoneName, passengers, required, zoneId, type }) {
  return `
    <div class="zone-card zone-card-trigger" data-zone="${zoneId}" data-type="${type}" style="cursor: pointer;">
      <div class="zone-card-left">
        <div class="zone-name">${zoneName}</div>
        <div class="zone-passengers">${passengers.toLocaleString()}<span class="unit">명</span></div>
        <div class="zone-required">필요: <span class="staff-count">${required}명</span></div>
      </div>
      <div class="zone-card-right">
        <span>›</span>
      </div>
    </div>
  `;
}

/**
 * 구역 카드 리스트 생성
 */
export function ZoneCardList(zones, type) {
  const zoneLabels = type === 'arrival'
    ? { AB: 'A,B 구역', C: 'C 구역', D: 'D 구역', EF: 'E,F 구역' }
    : { AB: '1,2 구역', C: '3 구역', D: '4 구역', EF: '5,6 구역' };

  const zoneKeys = ['AB', 'C', 'D', 'EF'];

  return zoneKeys.map(key => {
    const zone = zones[key] || { passengers: 0, required: 0 };
    return ZoneCard({
      zoneName: zoneLabels[key],
      passengers: zone.passengers,
      required: zone.required,
      zoneId: key,
      type: type
    });
  }).join('');
}

/**
 * 구역별 히트맵 컴포넌트 클래스
 */
export class ZoneHeatmap {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
  }

  render(zoneData, type) {
    this.container = document.getElementById(this.containerId);
    if (!this.container) return;

    if (!zoneData) {
      this.container.innerHTML = '<div class="text-center" style="padding: 1rem; color: var(--color-text-muted);">데이터 없음</div>';
      return;
    }

    const zones = ['AB', 'C', 'D', 'EF'];
    const zoneLabels = type === 'arrival'
      ? { AB: 'A,B 구역', C: 'C 구역', D: 'D 구역', EF: 'E,F 구역' }
      : { AB: '1,2 구역', C: '3 구역', D: '4 구역', EF: '5,6 구역' };

    const cards = zones.map(zone => {
      const data = zoneData[zone] || { passengers: 0, required: 0, alertLevel: 'normal' };
      return ZoneCard({
        zoneName: zoneLabels[zone],
        passengers: data.passengers,
        required: data.required
      });
    }).join('');

    this.container.innerHTML = cards;
  }
}

/**
 * 데이터 입력 테이블 생성
 */
export function generateManualInputTable() {
  const tbody = document.getElementById('manual-input-body');
  if (!tbody) return;

  let html = '';
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0');
    html += `
      <tr>
        <td>${hour}시</td>
        <td><input type="number" id="arr-${i}" value="0" min="0"></td>
        <td><input type="number" id="dep-${i}" value="0" min="0"></td>
      </tr>
    `;
  }
  tbody.innerHTML = html;
}

/**
 * 설정 패널 HTML 생성
 */
export function generateSettingsHTML(settings) {
  return `
    <div class="settings-group">
      <div class="settings-item">
        <span class="settings-label">심사 속도 (내국인 입국)</span>
        <div class="settings-value">
          <div class="slider-container">
            <input type="range" id="setting-arr-korean" min="20" max="100" value="${settings.serviceRates?.arrivalKorean || 60}">
            <span class="settings-number" id="val-arr-korean">${settings.serviceRates?.arrivalKorean || 60}명/시간</span>
          </div>
        </div>
      </div>

      <div class="settings-item">
        <span class="settings-label">심사 속도 (외국인 입국)</span>
        <div class="settings-value">
          <div class="slider-container">
            <input type="range" id="setting-arr-foreign" min="20" max="100" value="${settings.serviceRates?.arrivalForeign || 40}">
            <span class="settings-number" id="val-arr-foreign">${settings.serviceRates?.arrivalForeign || 40}명/시간</span>
          </div>
        </div>
      </div>

      <div class="settings-item">
        <span class="settings-label">목표 대기 시간</span>
        <div class="settings-value">
          <div class="slider-container">
            <input type="range" id="setting-wait-time" min="5" max="30" value="${settings.targetWaitTime || 15}">
            <span class="settings-number" id="val-wait-time">${settings.targetWaitTime || 15}분</span>
          </div>
        </div>
      </div>

      <div class="settings-item">
        <span class="settings-label">목표 가동률</span>
        <div class="settings-value">
          <div class="slider-container">
            <input type="range" id="setting-utilization" min="50" max="100" value="${(settings.targetUtilization || 0.85) * 100}">
            <span class="settings-number" id="val-utilization">${Math.round((settings.targetUtilization || 0.85) * 100)}%</span>
          </div>
        </div>
      </div>

      <div class="settings-item">
        <span class="settings-label">자동심사대 이용률</span>
        <div class="settings-value">
          <div class="slider-container">
            <input type="range" id="setting-autogate" min="0" max="50" value="${(settings.autoGateRatio || 0.3) * 100}">
            <span class="settings-number" id="val-autogate">${Math.round((settings.autoGateRatio || 0.3) * 100)}%</span>
          </div>
        </div>
      </div>

      <div class="settings-item">
        <span class="settings-label">다크 모드</span>
        <div class="settings-value">
          <label class="toggle-switch">
            <input type="checkbox" id="setting-darkmode" ${settings.theme === 'dark' ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
      
      <div style="margin-top: 20px; text-align: right;">
        <button id="btn-save-settings" class="data-save-btn">설정 저장</button>
      </div>
    </div>
  `;
}
