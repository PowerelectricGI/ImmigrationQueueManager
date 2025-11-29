# LLD: 출입국 심사관 배치 자동화 시스템 (Immigration Queue Manager)

## 1. 시스템 아키텍처

### 1.1 전체 구조 (Phase 1 - MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   UI Layer  │  │  Business   │  │     Data Layer          │  │
│  │             │  │   Logic     │  │                         │  │
│  │ - HTML/CSS  │◄─┤             │◄─┤ - LocalStorage          │  │
│  │ - DOM       │  │ - Forecast  │  │ - IndexedDB             │  │
│  │ - Events    │  │ - Calculate │  │ - Import/Export         │  │
│  │ - Chart.js  │  │ - Alert     │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     Service Worker (PWA)                        │
│                     - Offline Cache                             │
│                     - Background Sync                           │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 디렉토리 구조

```
ImmigrationQueueManager/
├── docs/
│   ├── PRD.md
│   └── LLD.md
├── src/
│   ├── index.html              # 메인 HTML
│   ├── css/
│   │   ├── main.css            # 메인 스타일
│   │   ├── variables.css       # CSS 변수 (테마, 색상)
│   │   ├── components.css      # 컴포넌트 스타일
│   │   └── responsive.css      # 반응형 스타일
│   ├── js/
│   │   ├── app.js              # 앱 초기화, 라우팅
│   │   ├── config.js           # 설정값, 상수
│   │   ├── data/
│   │   │   ├── storage.js      # LocalStorage/IndexedDB 관리
│   │   │   ├── importer.js     # CSV/Excel 파일 파싱
│   │   │   └── sampleData.js   # 샘플 데이터
│   │   ├── core/
│   │   │   ├── calculator.js   # 필요 인원 계산 엔진
│   │   │   ├── queueModel.js   # 대기행렬 모델 (M/M/c)
│   │   │   └── alertSystem.js  # 경보 판단 로직
│   │   ├── ui/
│   │   │   ├── dashboard.js    # 대시보드 UI
│   │   │   ├── dataInput.js    # 데이터 입력 UI
│   │   │   ├── settings.js     # 설정 UI
│   │   │   ├── chart.js        # 차트 래퍼
│   │   │   └── components.js   # 공통 UI 컴포넌트
│   │   └── utils/
│   │       ├── helpers.js      # 유틸리티 함수
│   │       ├── formatter.js    # 데이터 포맷팅
│   │       └── validators.js   # 입력 검증
│   ├── assets/
│   │   ├── icons/              # 앱 아이콘 (PWA)
│   │   └── images/             # 이미지 리소스
│   ├── manifest.json           # PWA 매니페스트
│   └── sw.js                   # Service Worker
├── tests/
│   ├── calculator.test.js
│   └── queueModel.test.js
└── README.md
```

---

## 2. 데이터 모델

### 2.1 핵심 데이터 구조

#### 2.1.1 승객 예고 데이터 (PassengerForecast)

```javascript
/**
 * @typedef {Object} ZoneData
 * @property {number} AB - A,B 구역 승객 수 (입국) 또는 1,2 구역 (출국)
 * @property {number} C - C 구역 승객 수 (입국) 또는 3 구역 (출국)
 * @property {number} D - D 구역 승객 수 (입국) 또는 4 구역 (출국)
 * @property {number} EF - E,F 구역 승객 수 (입국) 또는 5,6 구역 (출국)
 * @property {number} total - 합계
 */

/**
 * @typedef {Object} HourlyData
 * @property {string} hour - 시간대 (예: "07~08")
 * @property {number} hourStart - 시작 시간 (0-23)
 * @property {ZoneData} arrival - 입국 데이터
 * @property {ZoneData} departure - 출국 데이터
 */

/**
 * @typedef {Object} PassengerForecast
 * @property {string} id - UUID
 * @property {string} date - 날짜 (YYYY-MM-DD)
 * @property {string} terminal - 터미널 (T1, T2)
 * @property {string} lastUpdated - 마지막 업데이트 시각 (ISO 8601)
 * @property {string} source - 데이터 출처 (manual, csv, crawl)
 * @property {HourlyData[]} hourlyData - 24시간 데이터 배열
 */

const PassengerForecastSchema = {
  id: "uuid-v4",
  date: "2024-01-15",
  terminal: "T1",
  lastUpdated: "2024-01-14T17:00:00+09:00",
  source: "manual",
  hourlyData: [
    {
      hour: "00~01",
      hourStart: 0,
      arrival: { AB: 541, C: 0, D: 0, EF: 0, total: 541 },
      departure: { AB: 0, C: 724, D: 0, EF: 0, total: 724 }
    },
    // ... 24개 항목
  ]
};
```

#### 2.1.2 필요 인원 계산 결과 (StaffRequirement)

```javascript
/**
 * @typedef {Object} ZoneRequirement
 * @property {number} passengers - 해당 구역 승객 수
 * @property {number} required - 필요 심사관 수
 * @property {number} serviceRate - 적용된 처리 속도 (명/시간)
 * @property {string} alertLevel - 경보 수준 (normal, blue, yellow, orange, red)
 */

/**
 * @typedef {Object} HourlyRequirement
 * @property {string} hour - 시간대
 * @property {number} hourStart - 시작 시간
 * @property {Object} arrival - 입국 구역별 필요 인원
 * @property {Object} departure - 출국 구역별 필요 인원
 * @property {number} totalArrival - 입국 총 필요 인원
 * @property {number} totalDeparture - 출국 총 필요 인원
 * @property {string} alertLevel - 해당 시간대 경보 수준
 */

/**
 * @typedef {Object} StaffRequirement
 * @property {string} id - UUID
 * @property {string} forecastId - 연결된 PassengerForecast ID
 * @property {string} date - 날짜
 * @property {string} calculatedAt - 계산 시각
 * @property {CalculationParams} parameters - 계산에 사용된 파라미터
 * @property {HourlyRequirement[]} hourlyRequirement - 시간대별 필요 인원
 * @property {Summary} summary - 요약 정보
 */

const StaffRequirementSchema = {
  id: "uuid-v4",
  forecastId: "forecast-uuid",
  date: "2024-01-15",
  calculatedAt: "2024-01-14T18:30:00+09:00",
  parameters: {
    serviceRates: {
      arrivalKorean: 60,
      arrivalForeign: 40,
      departureKorean: 70,
      departureForeign: 50,
      autoGate: 120
    },
    targetUtilization: 0.85,
    targetWaitTime: 15,
    autoGateRatio: 0.3
  },
  hourlyRequirement: [
    {
      hour: "07~08",
      hourStart: 7,
      arrival: {
        AB: { passengers: 1539, required: 3, serviceRate: 60, alertLevel: "normal" },
        C: { passengers: 348, required: 1, serviceRate: 60, alertLevel: "normal" },
        D: { passengers: 352, required: 1, serviceRate: 60, alertLevel: "normal" },
        EF: { passengers: 2334, required: 4, serviceRate: 60, alertLevel: "normal" }
      },
      departure: {
        AB: { passengers: 2145, required: 4, serviceRate: 65, alertLevel: "normal" },
        C: { passengers: 1327, required: 3, serviceRate: 65, alertLevel: "normal" },
        D: { passengers: 1079, required: 2, serviceRate: 65, alertLevel: "normal" },
        EF: { passengers: 1419, required: 3, serviceRate: 65, alertLevel: "normal" }
      },
      totalArrival: 9,
      totalDeparture: 12,
      alertLevel: "normal"
    }
  ],
  summary: {
    peakHour: "08~09",
    maxArrival: 4573,
    maxDeparture: 5970,
    maxArrivalStaff: 10,
    maxDepartureStaff: 14,
    totalDailyArrival: 66789,
    totalDailyDeparture: 66120,
    alertHours: ["07~08", "08~09", "17~18"]
  }
};
```

#### 2.1.3 설정 데이터 (Settings)

```javascript
/**
 * @typedef {Object} ServiceRates
 * @property {number} arrivalKorean - 내국인 입국 처리 속도 (명/시간/심사관)
 * @property {number} arrivalForeign - 외국인 입국 처리 속도
 * @property {number} departureKorean - 내국인 출국 처리 속도
 * @property {number} departureForeign - 외국인 출국 처리 속도
 * @property {number} autoGate - 전자게이트 처리 속도
 */

/**
 * @typedef {Object} AlertThresholds
 * @property {number} blue - BLUE 경보 기준 (시간당 명)
 * @property {number} yellow - YELLOW 경보 기준
 * @property {number} orange - ORANGE 경보 기준
 * @property {number} red - RED 경보 기준
 */

/**
 * @typedef {Object} Settings
 * @property {ServiceRates} serviceRates - 처리 속도 설정
 * @property {number} targetWaitTime - 목표 대기시간 (분)
 * @property {number} targetUtilization - 목표 활용률 (0-1)
 * @property {number} autoGateRatio - 전자게이트 이용 비율 (0-1)
 * @property {number} foreignRatio - 외국인 비율 (0-1)
 * @property {string} theme - 테마 (dark, light)
 * @property {string} language - 언어 (ko, en)
 * @property {AlertThresholds} alertThresholds - 경보 기준값
 */

const DefaultSettings = {
  serviceRates: {
    arrivalKorean: 60,      // 1분당 1명 = 시간당 60명
    arrivalForeign: 40,     // 1.5분당 1명 = 시간당 40명
    departureKorean: 70,    // 약 51초당 1명
    departureForeign: 50,   // 약 72초당 1명
    autoGate: 120           // 30초당 1명
  },
  targetWaitTime: 15,       // 분
  targetUtilization: 0.85,  // 85%
  autoGateRatio: 0.3,       // 30%가 전자게이트 이용
  foreignRatio: {
    arrival: 0.6,           // 입국 시 외국인 60%
    departure: 0.3          // 출국 시 외국인 30%
  },
  theme: "dark",
  language: "ko",
  alertThresholds: {
    blue: 7000,
    yellow: 7600,
    orange: 8200,
    red: 8600
  }
};
```

### 2.2 LocalStorage 키 구조

```javascript
const STORAGE_KEYS = {
  // 현재 활성 데이터
  CURRENT_FORECAST: 'iqm_current_forecast',
  CURRENT_REQUIREMENT: 'iqm_current_requirement',
  
  // 설정
  SETTINGS: 'iqm_settings',
  
  // 히스토리 (IndexedDB로 이전 고려)
  FORECAST_HISTORY: 'iqm_forecast_history',
  
  // 앱 상태
  APP_STATE: 'iqm_app_state',
  LAST_SYNC: 'iqm_last_sync'
};
```

---

## 3. 핵심 알고리즘

### 3.1 필요 인원 계산 (Calculator)

#### 3.1.1 기본 계산 공식

```javascript
/**
 * 필요 심사관 수 계산
 * 
 * 공식: c(t) = ceil(λ(t) / (ρ_max × μ_effective))
 * 
 * 여기서:
 * - λ(t): 시간당 승객 도착률 (명/시간)
 * - ρ_max: 목표 활용률 (기본 0.85)
 * - μ_effective: 유효 처리 속도 (내국인/외국인/전자게이트 가중 평균)
 * 
 * @param {number} passengers - 시간당 예상 승객 수
 * @param {Object} options - 계산 옵션
 * @returns {number} 필요 심사관 수
 */
function calculateRequiredStaff(passengers, options = {}) {
  const {
    targetUtilization = 0.85,
    serviceRateKorean = 60,
    serviceRateForeign = 40,
    serviceRateAutoGate = 120,
    foreignRatio = 0.5,
    autoGateRatio = 0.3
  } = options;

  // 전자게이트 이용 승객 제외
  const manualPassengers = passengers * (1 - autoGateRatio);
  
  // 가중 평균 처리 속도 계산
  const effectiveServiceRate = 
    serviceRateKorean * (1 - foreignRatio) + 
    serviceRateForeign * foreignRatio;
  
  // 필요 인원 계산
  const rawRequired = manualPassengers / (targetUtilization * effectiveServiceRate);
  
  // 올림 처리 (최소 1명)
  return Math.max(1, Math.ceil(rawRequired));
}
```

#### 3.1.2 구역별 계산

```javascript
/**
 * 전체 시간대별/구역별 필요 인원 계산
 * 
 * @param {PassengerForecast} forecast - 승객 예고 데이터
 * @param {Settings} settings - 설정값
 * @returns {StaffRequirement} 계산 결과
 */
function calculateAllRequirements(forecast, settings) {
  const hourlyRequirement = forecast.hourlyData.map(hourData => {
    // 입국 구역별 계산
    const arrivalReq = calculateZoneRequirements(
      hourData.arrival,
      settings,
      'arrival'
    );
    
    // 출국 구역별 계산
    const departureReq = calculateZoneRequirements(
      hourData.departure,
      settings,
      'departure'
    );
    
    // 경보 수준 판단
    const totalPassengers = hourData.arrival.total + hourData.departure.total;
    const alertLevel = determineAlertLevel(totalPassengers, settings.alertThresholds);
    
    return {
      hour: hourData.hour,
      hourStart: hourData.hourStart,
      arrival: arrivalReq,
      departure: departureReq,
      totalArrival: sumRequirements(arrivalReq),
      totalDeparture: sumRequirements(departureReq),
      alertLevel
    };
  });
  
  return {
    id: generateUUID(),
    forecastId: forecast.id,
    date: forecast.date,
    calculatedAt: new Date().toISOString(),
    parameters: extractParameters(settings),
    hourlyRequirement,
    summary: generateSummary(hourlyRequirement, forecast)
  };
}

/**
 * 구역별 필요 인원 계산
 */
function calculateZoneRequirements(zoneData, settings, type) {
  const zones = ['AB', 'C', 'D', 'EF'];
  const result = {};
  
  const serviceRates = type === 'arrival' 
    ? { korean: settings.serviceRates.arrivalKorean, foreign: settings.serviceRates.arrivalForeign }
    : { korean: settings.serviceRates.departureKorean, foreign: settings.serviceRates.departureForeign };
  
  const foreignRatio = type === 'arrival' 
    ? settings.foreignRatio.arrival 
    : settings.foreignRatio.departure;
  
  zones.forEach(zone => {
    const passengers = zoneData[zone] || 0;
    const required = calculateRequiredStaff(passengers, {
      targetUtilization: settings.targetUtilization,
      serviceRateKorean: serviceRates.korean,
      serviceRateForeign: serviceRates.foreign,
      serviceRateAutoGate: settings.serviceRates.autoGate,
      foreignRatio: foreignRatio,
      autoGateRatio: settings.autoGateRatio
    });
    
    const alertLevel = determineZoneAlertLevel(passengers);
    
    result[zone] = {
      passengers,
      required,
      serviceRate: calculateEffectiveRate(serviceRates, foreignRatio),
      alertLevel
    };
  });
  
  return result;
}
```

### 3.2 경보 시스템 (AlertSystem)

```javascript
/**
 * 경보 수준 결정
 * 
 * 인천공항 기준:
 * - BLUE: 시간당 7,000 ~ 7,600명
 * - YELLOW: 시간당 7,600 ~ 8,200명 또는 7,600명 초과 연속 2시간
 * - ORANGE: 시간당 8,200 ~ 8,600명 또는 7,600명 초과 연속 2시간
 * - RED: 시간당 8,600명 이상 또는 8,200명 초과 연속 2시간
 * 
 * @param {number} passengers - 시간당 총 승객 수
 * @param {AlertThresholds} thresholds - 경보 기준값
 * @returns {string} 경보 수준
 */
function determineAlertLevel(passengers, thresholds) {
  if (passengers >= thresholds.red) return 'red';
  if (passengers >= thresholds.orange) return 'orange';
  if (passengers >= thresholds.yellow) return 'yellow';
  if (passengers >= thresholds.blue) return 'blue';
  return 'normal';
}

/**
 * 연속 시간 기반 경보 수준 판단
 * 
 * @param {HourlyRequirement[]} hourlyData - 시간대별 데이터
 * @param {AlertThresholds} thresholds - 경보 기준값
 * @returns {Object} 시간대별 최종 경보 수준
 */
function determineConsecutiveAlerts(hourlyData, thresholds) {
  const alerts = {};
  
  for (let i = 0; i < hourlyData.length; i++) {
    const current = hourlyData[i];
    const prev = i > 0 ? hourlyData[i - 1] : null;
    
    let baseLevel = determineAlertLevel(
      current.arrival.total + current.departure.total,
      thresholds
    );
    
    // 연속 2시간 체크
    if (prev) {
      const prevTotal = prev.arrival.total + prev.departure.total;
      const currTotal = current.arrival.total + current.departure.total;
      
      // 7,600명 초과 연속 2시간 → 최소 YELLOW
      if (prevTotal > thresholds.yellow && currTotal > thresholds.yellow) {
        if (baseLevel === 'blue' || baseLevel === 'normal') {
          baseLevel = 'yellow';
        }
      }
      
      // 8,200명 초과 연속 2시간 → RED
      if (prevTotal > thresholds.orange && currTotal > thresholds.orange) {
        baseLevel = 'red';
      }
    }
    
    alerts[current.hour] = baseLevel;
  }
  
  return alerts;
}
```

### 3.3 M/M/c 대기행렬 모델 (고급)

```javascript
/**
 * M/M/c 모델 기반 대기시간 계산
 * 
 * 가정:
 * - 도착: 포아송 과정 (λ)
 * - 서비스: 지수 분포 (μ)
 * - 서버 수: c
 * 
 * @param {number} lambda - 도착률 (명/시간)
 * @param {number} mu - 서비스율 (명/시간/서버)
 * @param {number} c - 서버(심사관) 수
 * @returns {Object} 대기행렬 지표
 */
function calculateMMcMetrics(lambda, mu, c) {
  const rho = lambda / (c * mu);  // 활용률
  
  if (rho >= 1) {
    return {
      rho,
      stable: false,
      Lq: Infinity,
      Wq: Infinity,
      L: Infinity,
      W: Infinity
    };
  }
  
  // P0 (시스템이 비어있을 확률) 계산
  const a = lambda / mu;
  let sum = 0;
  for (let n = 0; n < c; n++) {
    sum += Math.pow(a, n) / factorial(n);
  }
  sum += Math.pow(a, c) / (factorial(c) * (1 - rho));
  const P0 = 1 / sum;
  
  // Lq (대기열 평균 길이)
  const Lq = (P0 * Math.pow(a, c) * rho) / (factorial(c) * Math.pow(1 - rho, 2));
  
  // Wq (대기열 평균 대기시간)
  const Wq = Lq / lambda;
  
  // L (시스템 내 평균 인원)
  const L = Lq + a;
  
  // W (시스템 내 평균 체류시간)
  const W = Wq + (1 / mu);
  
  return {
    rho,
    stable: true,
    Lq,          // 대기열 평균 길이 (명)
    Wq: Wq * 60, // 대기열 평균 대기시간 (분)
    L,           // 시스템 내 평균 인원 (명)
    W: W * 60    // 시스템 내 평균 체류시간 (분)
  };
}

/**
 * 목표 대기시간을 만족하는 최소 서버 수 찾기
 * 
 * @param {number} lambda - 도착률
 * @param {number} mu - 서비스율
 * @param {number} targetWq - 목표 대기시간 (분)
 * @returns {number} 필요 서버 수
 */
function findMinimumServers(lambda, mu, targetWq) {
  const targetWqHours = targetWq / 60;
  let c = Math.ceil(lambda / mu);  // 최소 안정 조건
  
  while (c < 100) {  // 안전 장치
    const metrics = calculateMMcMetrics(lambda, mu, c);
    if (metrics.stable && metrics.Wq <= targetWq) {
      return c;
    }
    c++;
  }
  
  return c;
}

// 팩토리얼 헬퍼
function factorial(n) {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}
```

---

## 4. UI 컴포넌트 설계

### 4.1 컴포넌트 구조

```
App
├── Header
│   ├── Logo
│   ├── DateSelector
│   └── SettingsButton
├── MainContent
│   ├── SummaryCards
│   │   ├── TotalPassengersCard
│   │   ├── PeakTimeCard
│   │   └── AlertStatusCard
│   ├── TimelineChart
│   │   ├── PassengerChart
│   │   └── StaffChart
│   ├── ZoneDetailPanel
│   │   ├── ArrivalZones
│   │   └── DepartureZones
│   └── AlertBanner (조건부)
├── TabBar (모바일)
│   ├── DashboardTab
│   ├── ArrivalTab
│   ├── DepartureTab
│   ├── DataTab
│   └── SettingsTab
└── Modal
    ├── DataInputModal
    ├── SettingsModal
    └── DetailModal
```

### 4.2 핵심 컴포넌트 명세

#### 4.2.1 SummaryCard

```javascript
/**
 * 요약 정보 카드 컴포넌트
 * 
 * @param {Object} props
 * @param {string} props.title - 카드 제목
 * @param {string|number} props.value - 주요 값
 * @param {string} props.subtitle - 부제목/설명
 * @param {string} props.alertLevel - 경보 수준 (색상 결정)
 * @param {string} props.icon - 아이콘 (optional)
 */
function SummaryCard({ title, value, subtitle, alertLevel = 'normal', icon }) {
  const colorMap = {
    normal: 'var(--color-success)',
    blue: 'var(--color-alert-blue)',
    yellow: 'var(--color-alert-yellow)',
    orange: 'var(--color-alert-orange)',
    red: 'var(--color-alert-red)'
  };
  
  return `
    <div class="summary-card" style="border-color: ${colorMap[alertLevel]}">
      <div class="card-header">
        ${icon ? `<span class="card-icon">${icon}</span>` : ''}
        <span class="card-title">${title}</span>
      </div>
      <div class="card-value" style="color: ${colorMap[alertLevel]}">
        ${value}
      </div>
      <div class="card-subtitle">${subtitle}</div>
    </div>
  `;
}
```

#### 4.2.2 TimelineChart

```javascript
/**
 * 시간대별 차트 컴포넌트
 * 
 * Chart.js 래퍼
 */
class TimelineChart {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.chart = null;
    this.options = {
      showPassengers: true,
      showStaff: true,
      ...options
    };
  }
  
  /**
   * 차트 초기화/업데이트
   * 
   * @param {HourlyRequirement[]} data - 시간대별 데이터
   */
  update(data) {
    const labels = data.map(d => d.hour);
    
    const datasets = [];
    
    if (this.options.showPassengers) {
      datasets.push({
        label: '입국 승객',
        data: data.map(d => d.arrival?.total || 0),
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        type: 'bar',
        yAxisID: 'y'
      });
      
      datasets.push({
        label: '출국 승객',
        data: data.map(d => d.departure?.total || 0),
        backgroundColor: 'rgba(233, 69, 96, 0.5)',
        borderColor: 'rgb(233, 69, 96)',
        type: 'bar',
        yAxisID: 'y'
      });
    }
    
    if (this.options.showStaff) {
      datasets.push({
        label: '필요 인원 (입국)',
        data: data.map(d => d.totalArrival || 0),
        borderColor: 'rgb(74, 222, 128)',
        backgroundColor: 'transparent',
        type: 'line',
        yAxisID: 'y1'
      });
      
      datasets.push({
        label: '필요 인원 (출국)',
        data: data.map(d => d.totalDeparture || 0),
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'transparent',
        type: 'line',
        yAxisID: 'y1'
      });
    }
    
    const config = {
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        scales: {
          y: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: '승객 수 (명)' }
          },
          y1: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: '필요 인원 (명)' },
            grid: { drawOnChartArea: false }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              afterBody: (context) => {
                const idx = context[0].dataIndex;
                const alertLevel = data[idx].alertLevel;
                return alertLevel !== 'normal' ? `⚠️ 경보: ${alertLevel.toUpperCase()}` : '';
              }
            }
          }
        }
      }
    };
    
    if (this.chart) {
      this.chart.data = config.data;
      this.chart.update();
    } else {
      this.chart = new Chart(this.ctx, config);
    }
  }
  
  /**
   * 특정 시간대 하이라이트
   */
  highlightHour(hourIndex) {
    // 해당 막대 강조 표시
  }
  
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
```

#### 4.2.3 ZoneHeatmap

```javascript
/**
 * 구역별 히트맵 컴포넌트
 */
class ZoneHeatmap {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
  }
  
  /**
   * 히트맵 렌더링
   * 
   * @param {Object} zoneData - 구역별 데이터
   * @param {string} type - 'arrival' | 'departure'
   */
  render(zoneData, type) {
    const zones = ['AB', 'C', 'D', 'EF'];
    const zoneLabels = type === 'arrival' 
      ? ['A,B 구역', 'C 구역', 'D 구역', 'E,F 구역']
      : ['1,2 출국장', '3 출국장', '4 출국장', '5,6 출국장'];
    
    const html = zones.map((zone, i) => {
      const data = zoneData[zone] || { passengers: 0, required: 0, alertLevel: 'normal' };
      const intensity = this.calculateIntensity(data.passengers);
      
      return `
        <div class="zone-cell" 
             style="background-color: ${this.getHeatColor(intensity, data.alertLevel)}"
             data-zone="${zone}">
          <div class="zone-label">${zoneLabels[i]}</div>
          <div class="zone-passengers">${data.passengers.toLocaleString()}명</div>
          <div class="zone-required">필요: ${data.required}명</div>
        </div>
      `;
    }).join('');
    
    this.container.innerHTML = `
      <div class="zone-heatmap ${type}">
        ${html}
      </div>
    `;
  }
  
  calculateIntensity(passengers) {
    // 0-1 범위로 정규화
    const max = 3000;  // 구역별 최대 예상 승객
    return Math.min(1, passengers / max);
  }
  
  getHeatColor(intensity, alertLevel) {
    if (alertLevel === 'red') return 'rgba(239, 68, 68, 0.8)';
    if (alertLevel === 'orange') return 'rgba(249, 115, 22, 0.8)';
    if (alertLevel === 'yellow') return 'rgba(251, 191, 36, 0.8)';
    if (alertLevel === 'blue') return 'rgba(59, 130, 246, 0.8)';
    
    // 정상 상태: 초록 ~ 노랑 그라데이션
    const r = Math.round(74 + (251 - 74) * intensity);
    const g = Math.round(222 - (222 - 191) * intensity);
    const b = Math.round(128 - (128 - 36) * intensity);
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
  }
}
```

### 4.3 CSS 변수 정의

```css
/* variables.css */
:root {
  /* 색상 - 다크 테마 */
  --color-bg-primary: #1a1a2e;
  --color-bg-secondary: #16213e;
  --color-bg-card: #1f2937;
  --color-bg-input: #374151;
  
  --color-text-primary: #e0e0e0;
  --color-text-secondary: #9ca3af;
  --color-text-muted: #6b7280;
  
  --color-accent: #e94560;
  --color-success: #4ade80;
  
  /* 경보 색상 */
  --color-alert-blue: #3b82f6;
  --color-alert-yellow: #fbbf24;
  --color-alert-orange: #f97316;
  --color-alert-red: #ef4444;
  
  /* 타이포그래피 */
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  
  /* 간격 */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* 반경 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 1rem;
  --radius-full: 9999px;
  
  /* 그림자 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  
  /* 트랜지션 */
  --transition-fast: 150ms ease;
  --transition-base: 300ms ease;
  
  /* 터치 타겟 */
  --touch-target-min: 44px;
  
  /* Z-index */
  --z-dropdown: 10;
  --z-modal: 100;
  --z-toast: 200;
}

/* 라이트 테마 */
[data-theme="light"] {
  --color-bg-primary: #f3f4f6;
  --color-bg-secondary: #ffffff;
  --color-bg-card: #ffffff;
  --color-bg-input: #e5e7eb;
  
  --color-text-primary: #1f2937;
  --color-text-secondary: #4b5563;
  --color-text-muted: #9ca3af;
}
```

---

## 5. 데이터 흐름

### 5.1 데이터 입력 → 계산 → 표시 흐름

```
┌──────────────────┐
│   데이터 입력     │
│  (수동/CSV/크롤) │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  데이터 검증      │
│  (Validator)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  저장소 저장      │
│  (Storage)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  필요 인원 계산   │
│  (Calculator)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  경보 판단        │
│  (AlertSystem)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  UI 업데이트      │
│  (Dashboard)     │
└──────────────────┘
```

### 5.2 이벤트 기반 아키텍처

```javascript
/**
 * 이벤트 버스 (Pub/Sub 패턴)
 */
class EventBus {
  constructor() {
    this.listeners = {};
  }
  
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    
    // unsubscribe 함수 반환
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

// 이벤트 정의
const EVENTS = {
  // 데이터 관련
  FORECAST_LOADED: 'forecast:loaded',
  FORECAST_UPDATED: 'forecast:updated',
  FORECAST_ERROR: 'forecast:error',
  
  // 계산 관련
  CALCULATION_START: 'calculation:start',
  CALCULATION_COMPLETE: 'calculation:complete',
  
  // 설정 관련
  SETTINGS_CHANGED: 'settings:changed',
  
  // UI 관련
  VIEW_CHANGED: 'view:changed',
  HOUR_SELECTED: 'hour:selected',
  
  // 경보 관련
  ALERT_TRIGGERED: 'alert:triggered'
};

// 글로벌 이벤트 버스
const eventBus = new EventBus();
```

---

## 6. 파일 가져오기/내보내기

### 6.1 CSV 파서

```javascript
/**
 * 인천공항 형식 CSV 파서
 */
class AirportDataImporter {
  /**
   * CSV 문자열 파싱
   * 
   * 예상 형식:
   * 시간,입국_AB,입국_C,입국_D,입국_EF,입국_합계,출국_12,출국_3,출국_4,출국_56,출국_합계
   * 00~01,541,0,0,0,541,0,724,0,0,724
   * ...
   * 
   * @param {string} csvString - CSV 문자열
   * @param {Object} options - 파싱 옵션
   * @returns {PassengerForecast} 파싱된 데이터
   */
  static parseCSV(csvString, options = {}) {
    const { date = new Date().toISOString().split('T')[0], terminal = 'T1' } = options;
    
    const lines = csvString.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const hourlyData = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row = {};
      
      headers.forEach((header, idx) => {
        row[header] = values[idx];
      });
      
      const hourMatch = row['시간']?.match(/(\d{2})~(\d{2})/);
      if (!hourMatch) continue;
      
      hourlyData.push({
        hour: row['시간'],
        hourStart: parseInt(hourMatch[1]),
        arrival: {
          AB: parseInt(row['입국_AB']) || 0,
          C: parseInt(row['입국_C']) || 0,
          D: parseInt(row['입국_D']) || 0,
          EF: parseInt(row['입국_EF']) || 0,
          total: parseInt(row['입국_합계']) || 0
        },
        departure: {
          AB: parseInt(row['출국_12']) || 0,
          C: parseInt(row['출국_3']) || 0,
          D: parseInt(row['출국_4']) || 0,
          EF: parseInt(row['출국_56']) || 0,
          total: parseInt(row['출국_합계']) || 0
        }
      });
    }
    
    return {
      id: generateUUID(),
      date,
      terminal,
      lastUpdated: new Date().toISOString(),
      source: 'csv',
      hourlyData
    };
  }
  
  /**
   * 파일 선택 핸들러
   */
  static async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const result = this.parseCSV(e.target.result);
          resolve(result);
        } catch (error) {
          reject(new Error(`파일 파싱 실패: ${error.message}`));
        }
      };
      
      reader.onerror = () => reject(new Error('파일 읽기 실패'));
      reader.readAsText(file, 'UTF-8');
    });
  }
}
```

### 6.2 데이터 내보내기

```javascript
/**
 * 계산 결과 CSV 내보내기
 */
class DataExporter {
  /**
   * 필요 인원표 CSV 생성
   * 
   * @param {StaffRequirement} requirement - 계산 결과
   * @returns {string} CSV 문자열
   */
  static toCSV(requirement) {
    const headers = [
      '시간',
      '입국_AB_승객', '입국_AB_인원',
      '입국_C_승객', '입국_C_인원',
      '입국_D_승객', '입국_D_인원',
      '입국_EF_승객', '입국_EF_인원',
      '입국_합계_승객', '입국_합계_인원',
      '출국_12_승객', '출국_12_인원',
      '출국_3_승객', '출국_3_인원',
      '출국_4_승객', '출국_4_인원',
      '출국_56_승객', '출국_56_인원',
      '출국_합계_승객', '출국_합계_인원',
      '경보수준'
    ];
    
    const rows = requirement.hourlyRequirement.map(hr => {
      return [
        hr.hour,
        hr.arrival.AB.passengers, hr.arrival.AB.required,
        hr.arrival.C.passengers, hr.arrival.C.required,
        hr.arrival.D.passengers, hr.arrival.D.required,
        hr.arrival.EF.passengers, hr.arrival.EF.required,
        hr.totalArrival, sumRequirements(hr.arrival),
        hr.departure.AB.passengers, hr.departure.AB.required,
        hr.departure.C.passengers, hr.departure.C.required,
        hr.departure.D.passengers, hr.departure.D.required,
        hr.departure.EF.passengers, hr.departure.EF.required,
        hr.totalDeparture, sumRequirements(hr.departure),
        hr.alertLevel
      ].join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }
  
  /**
   * CSV 파일 다운로드
   */
  static downloadCSV(requirement, filename) {
    const csv = this.toCSV(requirement);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `staff_requirement_${requirement.date}.csv`;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}
```

---

## 7. PWA 설정

### 7.1 Web App Manifest

```json
{
  "name": "Immigration Queue Manager",
  "short_name": "IQM",
  "description": "출입국 심사관 배치 자동화 시스템",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait-primary",
  "background_color": "#1a1a2e",
  "theme_color": "#e94560",
  "icons": [
    {
      "src": "/assets/icons/icon-72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/assets/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ],
  "categories": ["productivity", "utilities"],
  "lang": "ko"
}
```

### 7.2 Service Worker

```javascript
// sw.js
const CACHE_NAME = 'iqm-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/variables.css',
  '/css/components.css',
  '/css/responsive.css',
  '/js/app.js',
  '/js/config.js',
  '/js/data/storage.js',
  '/js/data/importer.js',
  '/js/data/sampleData.js',
  '/js/core/calculator.js',
  '/js/core/queueModel.js',
  '/js/core/alertSystem.js',
  '/js/ui/dashboard.js',
  '/js/ui/chart.js',
  '/js/ui/components.js',
  '/manifest.json'
];

// 설치
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// 요청 가로채기 (Cache First 전략)
self.addEventListener('fetch', (event) => {
  // API 요청은 네트워크 우선
  if (event.request.url.includes('/api/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  
  // 정적 자산은 캐시 우선
  event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    // 오프라인 폴백
    return caches.match('/offline.html');
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

---

## 8. 테스트 계획

### 8.1 단위 테스트

```javascript
// tests/calculator.test.js

describe('Calculator', () => {
  describe('calculateRequiredStaff', () => {
    test('기본 계산이 올바르게 수행되어야 함', () => {
      const passengers = 1000;
      const options = {
        targetUtilization: 0.85,
        serviceRateKorean: 60,
        serviceRateForeign: 40,
        foreignRatio: 0.5,
        autoGateRatio: 0.3
      };
      
      const result = calculateRequiredStaff(passengers, options);
      
      // 700명 (전자게이트 제외) / (0.85 * 50) = 16.47 → 17명
      expect(result).toBe(17);
    });
    
    test('승객 0명일 때 최소 1명 반환', () => {
      const result = calculateRequiredStaff(0, {});
      expect(result).toBe(1);
    });
    
    test('활용률 100%일 때 더 적은 인원 필요', () => {
      const options85 = { targetUtilization: 0.85 };
      const options100 = { targetUtilization: 1.0 };
      
      const result85 = calculateRequiredStaff(1000, options85);
      const result100 = calculateRequiredStaff(1000, options100);
      
      expect(result100).toBeLessThan(result85);
    });
  });
  
  describe('determineAlertLevel', () => {
    const thresholds = { blue: 7000, yellow: 7600, orange: 8200, red: 8600 };
    
    test('정상 범위', () => {
      expect(determineAlertLevel(5000, thresholds)).toBe('normal');
    });
    
    test('BLUE 범위', () => {
      expect(determineAlertLevel(7300, thresholds)).toBe('blue');
    });
    
    test('YELLOW 범위', () => {
      expect(determineAlertLevel(7800, thresholds)).toBe('yellow');
    });
    
    test('ORANGE 범위', () => {
      expect(determineAlertLevel(8400, thresholds)).toBe('orange');
    });
    
    test('RED 범위', () => {
      expect(determineAlertLevel(9000, thresholds)).toBe('red');
    });
  });
});
```

### 8.2 통합 테스트 시나리오

| 시나리오 | 단계 | 예상 결과 |
|----------|------|----------|
| 데이터 입력 → 계산 | 1. CSV 파일 업로드<br>2. 자동 파싱<br>3. 계산 실행 | 시간대별 필요 인원 표시 |
| 설정 변경 → 재계산 | 1. 처리 속도 변경<br>2. 저장 | 즉시 재계산 및 UI 업데이트 |
| 오프라인 동작 | 1. 데이터 로드<br>2. 네트워크 끊김<br>3. 앱 새로고침 | 캐시된 데이터로 정상 동작 |
| 모바일 반응형 | 1. 다양한 화면 크기<br>2. 터치 인터랙션 | 레이아웃 적응, 44px 터치 타겟 |

---

## 9. 배포 전략

### 9.1 Phase 1 배포 (정적 호스팅)

```
GitHub Pages / Netlify / Vercel
    │
    ▼
┌─────────────────────────────┐
│  CDN (CloudFlare/Fastly)    │
│  - 정적 자산 캐싱            │
│  - HTTPS                    │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  Client Browser             │
│  - Service Worker 캐싱      │
│  - LocalStorage 데이터      │
└─────────────────────────────┘
```

### 9.2 배포 체크리스트

- [ ] 빌드 최적화 (minification, tree-shaking)
- [ ] 이미지 최적화 (WebP, lazy loading)
- [ ] HTTPS 적용
- [ ] CSP (Content Security Policy) 헤더
- [ ] Lighthouse 점수 확인 (90+ 목표)
- [ ] 크로스 브라우저 테스트
- [ ] 모바일 기기 테스트

---

## 10. 향후 확장 고려사항

### 10.1 Phase 2 준비

- 백엔드 API 인터페이스 정의
- 인증 토큰 관리 구조
- 실시간 WebSocket 연결 관리

### 10.2 Phase 3 준비

- 데이터베이스 스키마 설계
- 크롤러 스케줄러 설계
- 다중 터미널/공항 지원 구조

---

## 부록: 유틸리티 함수

```javascript
// utils/helpers.js

/**
 * UUID v4 생성
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 디바운스
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 스로틀
 */
function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 숫자 포맷팅 (천 단위 콤마)
 */
function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

/**
 * 날짜 포맷팅
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day);
}

/**
 * 구역별 필요 인원 합계
 */
function sumRequirements(zoneReq) {
  return Object.values(zoneReq).reduce((sum, zone) => {
    return sum + (zone.required || 0);
  }, 0);
}
```
