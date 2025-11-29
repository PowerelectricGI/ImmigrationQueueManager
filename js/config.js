/**
 * src/js/config.js
 * 시스템 설정 및 상수 정의
 */

export const DefaultSettings = {
    // 심사 처리 속도 (명/시간)
    serviceRates: {
        arrivalKorean: 60,      // 1분당 1명
        arrivalForeign: 40,     // 1.5분당 1명
        departureKorean: 70,    // 약 51초당 1명
        departureForeign: 50,   // 약 72초당 1명
        autoGate: 120           // 30초당 1명
    },

    // 목표 지표
    targetWaitTime: 15,       // 목표 대기시간 (분)
    targetUtilization: 0.85,  // 목표 심사관 활용률 (85%)

    // 비율 설정
    autoGateRatio: 0.3,       // 전자게이트 이용률 (30%)
    foreignRatio: {
        arrival: 0.6,           // 입국 시 외국인 비율 (60%)
        departure: 0.3          // 출국 시 외국인 비율 (30%)
    },

    // 시스템 설정
    theme: "dark",
    language: "ko",

    // 인천공항 혼잡도 경보 기준 (명/시간)
    alertThresholds: {
        blue: 7000,
        yellow: 7600,
        orange: 8200,
        red: 8600
    }
};

export const STORAGE_KEYS = {
    CURRENT_FORECAST: 'iqm_current_forecast',
    CURRENT_REQUIREMENT: 'iqm_current_requirement',
    SETTINGS: 'iqm_settings',
    FORECAST_HISTORY: 'iqm_forecast_history',
    APP_STATE: 'iqm_app_state',
    STAFF: 'iqm_staff_list'
};
