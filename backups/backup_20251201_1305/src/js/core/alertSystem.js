/**
 * src/js/core/alertSystem.js
 * 혼잡도 경보 판단 로직
 */

/**
 * 단일 시간대 승객 수에 따른 경보 수준 결정
 * 
 * 인천공항 기준:
 * - BLUE: 시간당 7,000 ~ 7,600명
 * - YELLOW: 시간당 7,600 ~ 8,200명
 * - ORANGE: 시간당 8,200 ~ 8,600명
 * - RED: 시간당 8,600명 이상
 * 
 * @param {number} passengers - 시간당 총 승객 수
 * @param {Object} thresholds - 경보 기준값 (blue, yellow, orange, red)
 * @returns {string} 경보 수준 ('normal', 'blue', 'yellow', 'orange', 'red')
 */
export function determineAlertLevel(passengers, thresholds) {
    if (passengers >= thresholds.red) return 'red';
    if (passengers >= thresholds.orange) return 'orange';
    if (passengers >= thresholds.yellow) return 'yellow';
    if (passengers >= thresholds.blue) return 'blue';
    return 'normal';
}

/**
 * 연속 시간 기반 경보 수준 판단 (전체 시간대)
 * 
 * 추가 규칙:
 * - YELLOW: 7,600명 초과 연속 2시간
 * - RED: 8,200명 초과 연속 2시간
 * 
 * @param {Array} hourlyData - 시간대별 데이터 배열 (arrival, departure 포함)
 * @param {Object} thresholds - 경보 기준값
 * @returns {Object} 시간대별 최종 경보 수준 맵 { "07~08": "blue", ... }
 */
export function determineConsecutiveAlerts(hourlyData, thresholds) {
    const alerts = {};

    for (let i = 0; i < hourlyData.length; i++) {
        const current = hourlyData[i];
        const prev = i > 0 ? hourlyData[i - 1] : null;

        // 현재 시간대 총 승객 수
        const currTotal = (current.arrival?.total || 0) + (current.departure?.total || 0);

        // 기본 경보 레벨
        let baseLevel = determineAlertLevel(currTotal, thresholds);

        // 연속 2시간 체크
        if (prev) {
            const prevTotal = (prev.arrival?.total || 0) + (prev.departure?.total || 0);

            // 7,600명(Yellow 기준) 초과 연속 2시간 → 최소 YELLOW
            if (prevTotal > thresholds.yellow && currTotal > thresholds.yellow) {
                if (baseLevel === 'blue' || baseLevel === 'normal') {
                    baseLevel = 'yellow';
                }
            }

            // 8,200명(Orange 기준) 초과 연속 2시간 → RED
            if (prevTotal > thresholds.orange && currTotal > thresholds.orange) {
                baseLevel = 'red';
            }
        }

        alerts[current.hour] = baseLevel;
    }

    return alerts;
}
