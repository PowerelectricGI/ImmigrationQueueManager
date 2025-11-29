/**
 * src/js/core/calculator.js
 * 필요 심사관 수 계산 엔진
 */

import { generateUUID, sumRequirements } from '../utils/helpers.js';
import { determineAlertLevel, determineConsecutiveAlerts } from './alertSystem.js';

/**
 * 단일 구역/시간대 필요 심사관 수 계산
 * 
 * 공식: c(t) = ceil(λ(t) / (ρ_max × μ_effective))
 * 
 * @param {number} passengers - 시간당 예상 승객 수
 * @param {Object} options - 계산 옵션
 * @returns {number} 필요 심사관 수
 */
export function calculateRequiredStaff(passengers, options = {}) {
    const {
        targetUtilization = 0.85,
        serviceRateKorean = 60,
        serviceRateForeign = 40,
        foreignRatio = 0.5,
        autoGateRatio = 0.3
    } = options;

    if (passengers <= 0) return 0;

    // 전자게이트 이용 승객 제외 (유인 부스 대상 승객)
    const manualPassengers = passengers * (1 - autoGateRatio);

    // 가중 평균 처리 속도 계산 (내국인/외국인 비율 반영)
    const effectiveServiceRate =
        serviceRateKorean * (1 - foreignRatio) +
        serviceRateForeign * foreignRatio;

    // 필요 인원 계산
    // c = λ / (ρ * μ)
    const rawRequired = manualPassengers / (targetUtilization * effectiveServiceRate);

    // 올림 처리 (최소 1명, 승객이 있으면)
    return Math.max(1, Math.ceil(rawRequired));
}

/**
 * 구역별 필요 인원 계산 헬퍼 함수
 * 
 * @param {Object} zoneData - 구역별 승객 데이터 { AB: 100, C: 200 ... }
 * @param {Object} settings - 전체 설정 객체
 * @param {string} type - 'arrival' 또는 'departure'
 * @returns {Object} 구역별 계산 결과
 */
function calculateZoneRequirements(zoneData, settings, type) {
    const zones = ['AB', 'C', 'D', 'EF']; // 입국장 구역 (출국장은 12, 3, 4, 56 매핑 필요하나 데이터 구조상 키값 사용)
    // 데이터 키값에 맞춰 동적으로 처리
    const dataKeys = Object.keys(zoneData).filter(k => k !== 'total');

    const result = {};

    const serviceRates = type === 'arrival'
        ? { korean: settings.serviceRates.arrivalKorean, foreign: settings.serviceRates.arrivalForeign }
        : { korean: settings.serviceRates.departureKorean, foreign: settings.serviceRates.departureForeign };

    const foreignRatio = type === 'arrival'
        ? settings.foreignRatio.arrival
        : settings.foreignRatio.departure;

    dataKeys.forEach(zone => {
        const passengers = zoneData[zone] || 0;

        // 필요 인원 계산
        const required = calculateRequiredStaff(passengers, {
            targetUtilization: settings.targetUtilization,
            serviceRateKorean: serviceRates.korean,
            serviceRateForeign: serviceRates.foreign,
            foreignRatio: foreignRatio,
            autoGateRatio: settings.autoGateRatio
        });

        // 구역별 경보 (단순 승객 수 기준 예시, 실제로는 전체 혼잡도 위주로 판단하지만 개별 표시용)
        // 구역별 임계값은 별도 정의가 없으므로 'normal'로 두거나 비례해서 추정 가능.
        // 여기서는 일단 'normal'로 두고 상위에서 전체 합계로 판단함.
        const alertLevel = 'normal';

        result[zone] = {
            passengers,
            required,
            serviceRate: serviceRates.korean * (1 - foreignRatio) + serviceRates.foreign * foreignRatio, // 유효 속도 참고용
            alertLevel
        };
    });

    return result;
}

/**
 * 전체 시간대별/구역별 필요 인원 계산 메인 함수
 * 
 * @param {Object} forecast - 승객 예고 데이터 (PassengerForecast)
 * @param {Object} settings - 설정값 (Settings)
 * @returns {Object} 계산 결과 (StaffRequirement)
 */
export function calculateAllRequirements(forecast, settings) {
    // 1. 시간대별 기본 계산
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

        return {
            hour: hourData.hour,
            hourStart: hourData.hourStart,
            arrival: arrivalReq,
            departure: departureReq,
            totalArrival: sumRequirements(arrivalReq),
            totalDeparture: sumRequirements(departureReq),
            // Explicit passenger totals (prefer source total, fallback to sum)
            arrivalPassengers: hourData.arrival.total || Object.values(arrivalReq).reduce((sum, z) => sum + (z.passengers || 0), 0),
            departurePassengers: hourData.departure.total || Object.values(departureReq).reduce((sum, z) => sum + (z.passengers || 0), 0),
            // alertLevel은 전체 흐름을 보고 결정하기 위해 아래에서 다시 처리
            alertLevel: 'normal'
        };
    });

    // 2. 연속 시간 고려한 경보 레벨 결정
    const alertLevels = determineConsecutiveAlerts(hourlyRequirement, settings.alertThresholds);

    // 3. 경보 레벨 병합
    hourlyRequirement.forEach(req => {
        req.alertLevel = alertLevels[req.hour] || 'normal';
    });

    // 4. 요약 정보 생성
    const summary = {
        totalDailyArrival: 0,
        totalDailyDeparture: 0,
        maxArrivalStaff: 0,
        maxDepartureStaff: 0,
        peakHour: null,
        maxTotalPassengers: 0,
        alertHours: []
    };

    hourlyRequirement.forEach(req => {
        const totalArr = req.arrival.total || (req.arrival.AB.passengers + req.arrival.C.passengers + req.arrival.D.passengers + req.arrival.EF.passengers); // 데이터 구조에 따라 다름, 여기선 계산된 req 안의 passengers 합산 필요
        // calculateZoneRequirements에서 passengers를 그대로 넘겼으므로 합산
        const currentTotalArrival = Object.values(req.arrival).reduce((sum, z) => sum + z.passengers, 0);
        const currentTotalDeparture = Object.values(req.departure).reduce((sum, z) => sum + z.passengers, 0);

        summary.totalDailyArrival += currentTotalArrival;
        summary.totalDailyDeparture += currentTotalDeparture;

        summary.maxArrivalStaff = Math.max(summary.maxArrivalStaff, req.totalArrival);
        summary.maxDepartureStaff = Math.max(summary.maxDepartureStaff, req.totalDeparture);

        const totalPassengers = currentTotalArrival + currentTotalDeparture;
        if (totalPassengers > summary.maxTotalPassengers) {
            summary.maxTotalPassengers = totalPassengers;
            summary.peakHour = req.hour;
        }

        if (req.alertLevel !== 'normal') {
            summary.alertHours.push(req.hour);
        }
    });

    return {
        id: generateUUID(),
        forecastId: forecast.id,
        date: forecast.date,
        calculatedAt: new Date().toISOString(),
        parameters: { ...settings }, // 설정 스냅샷
        hourlyRequirement,
        summary
    };
}
