/**
 * src/js/utils/helpers.js
 * 유틸리티 함수 모음
 */

/**
 * UUID v4 생성
 * @returns {string} UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 구역별 필요 인원 합계 계산
 * @param {Object} zoneReq - 구역별 요구사항 객체
 * @returns {number} 합계
 */
export function sumRequirements(zoneReq) {
  if (!zoneReq) return 0;
  return Object.values(zoneReq).reduce((sum, zone) => {
    return sum + (zone.required || 0);
  }, 0);
}
