/**
 * src/js/core/queueModel.js
 * M/M/c 대기행렬 모델 구현
 */

/**
 * 팩토리얼 계산
 * @param {number} n 
 * @returns {number} n!
 */
function factorial(n) {
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) {
        result *= i;
    }
    return result;
}

/**
 * M/M/c 모델 기반 대기행렬 지표 계산
 * 
 * @param {number} lambda - 도착률 (명/시간)
 * @param {number} mu - 서비스율 (명/시간/서버)
 * @param {number} c - 서버(심사관) 수
 * @returns {Object} 대기행렬 지표 (rho, Lq, Wq, L, W, stable)
 */
export function calculateMMcMetrics(lambda, mu, c) {
    // 유효성 검사
    if (c <= 0 || mu <= 0) {
        return { stable: false, error: "Invalid parameters" };
    }

    const rho = lambda / (c * mu);  // 활용률

    // 시스템 불안정 (도착률이 처리용량 초과)
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
    const a = lambda / mu; // 트래픽 밀도
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
 * 목표 대기시간을 만족하는 최소 서버(심사관) 수 찾기
 * 
 * @param {number} lambda - 도착률 (명/시간)
 * @param {number} mu - 서비스율 (명/시간/서버)
 * @param {number} targetWq - 목표 대기시간 (분)
 * @returns {number} 필요 서버 수
 */
export function findMinimumServers(lambda, mu, targetWq) {
    if (lambda <= 0) return 0;

    let c = Math.ceil(lambda / mu);  // 최소 안정 조건 (활용률 < 1)
    if (c === 0) c = 1;

    // 안전 장치: 최대 100명까지 탐색
    while (c < 100) {
        const metrics = calculateMMcMetrics(lambda, mu, c);
        if (metrics.stable && metrics.Wq <= targetWq) {
            return c;
        }
        c++;
    }

    return c;
}
