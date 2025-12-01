/**
 * src/js/ui/parking.js
 * 주차장 현황 UI 모듈
 */

export class ParkingUI {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.parkingData = null;
    }

    /**
     * 주차장 데이터 설정 및 렌더링
     * @param {Object} data - 주차장 데이터
     */
    setData(data) {
        this.parkingData = data;
        this.render();
    }

    /**
     * 주차장 현황 렌더링
     */
    render() {
        const container = document.getElementById('parking-content');
        if (!container) return;

        if (!this.parkingData) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const { shortTerm, longTerm, lastUpdated, errors, isSample } = this.parkingData;

        let html = '';

        // 업데이트 시간 표시
        html += `
            <div class="parking-header">
                <div class="parking-update-time">
                    <span class="update-icon">🕐</span>
                    <span>마지막 업데이트: ${this.formatTime(lastUpdated)}</span>
                    ${isSample ? '<span class="sample-badge">샘플 데이터</span>' : ''}
                </div>
            </div>
        `;

        // 에러 표시
        if (errors && errors.length > 0) {
            html += `
                <div class="parking-errors">
                    ${errors.map(e => `<div class="error-item">⚠️ ${e}</div>`).join('')}
                </div>
            `;
        }

        // 단기주차장 섹션
        html += `
            <section class="parking-section">
                <div class="parking-section-header">
                    <h3>🅿️ 단기주차장</h3>
                    <span class="parking-section-subtitle">제1여객터미널</span>
                </div>
                <div class="parking-grid short-term">
                    ${this.renderParkingCard(shortTerm.floor1, 'floor1')}
                    ${this.renderParkingCard(shortTerm.basement1, 'basement1')}
                    ${this.renderParkingCard(shortTerm.basement2, 'basement2')}
                </div>
            </section>
        `;

        // 장기주차장 섹션
        html += `
            <section class="parking-section">
                <div class="parking-section-header">
                    <h3>🅿️ 장기주차장</h3>
                    <span class="parking-section-subtitle">제1여객터미널</span>
                </div>
                
                <div class="parking-subsection">
                    <h4 class="parking-subsection-title">🔵 동편</h4>
                    <div class="parking-grid long-term">
                        ${this.renderParkingCard(longTerm.east.p1, 'east-p1')}
                        ${this.renderParkingCard(longTerm.east.tower, 'east-tower')}
                        ${this.renderParkingCard(longTerm.east.p3, 'east-p3')}
                    </div>
                </div>

                <div class="parking-subsection">
                    <h4 class="parking-subsection-title">🟠 서편</h4>
                    <div class="parking-grid long-term">
                        ${this.renderParkingCard(longTerm.west.p2, 'west-p2')}
                        ${this.renderParkingCard(longTerm.west.tower, 'west-tower')}
                        ${this.renderParkingCard(longTerm.west.p4, 'west-p4')}
                    </div>
                </div>
            </section>
        `;

        container.innerHTML = html;
    }

    /**
     * 주차장 카드 렌더링
     * @param {Object} data - 주차장 데이터 { available, name }
     * @param {string} id - 고유 ID
     * @returns {string} HTML 문자열
     */
    renderParkingCard(data, id) {
        const available = data.available;
        const name = data.name;

        // 여유 상태 판단 (주차 가능 대수 기준)
        let statusClass = 'status-normal';
        let statusText = '여유';
        let statusIcon = '🟢';

        if (typeof available === 'number') {
            if (available <= 50) {
                statusClass = 'status-critical';
                statusText = '혼잡';
                statusIcon = '🔴';
            } else if (available <= 150) {
                statusClass = 'status-warning';
                statusText = '보통';
                statusIcon = '🟡';
            }
        } else if (available === '-' || available === 0) {
            statusClass = 'status-unknown';
            statusText = '확인불가';
            statusIcon = '⚪';
        }

        return `
            <div class="parking-card ${statusClass}" id="parking-${id}">
                <div class="parking-card-header">
                    <span class="parking-name">${name}</span>
                    <span class="parking-status">${statusIcon} ${statusText}</span>
                </div>
                <div class="parking-card-body">
                    <div class="parking-available">
                        <span class="available-number">${typeof available === 'number' ? available.toLocaleString() : available}</span>
                        <span class="available-label">주차가능</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 빈 상태 렌더링
     * @returns {string} HTML 문자열
     */
    renderEmptyState() {
        return `
            <div class="parking-empty">
                <div class="empty-icon">🅿️</div>
                <div class="empty-text">주차장 데이터가 없습니다</div>
                <div class="empty-hint">위의 "주차장 현황 가져오기" 버튼을 클릭하세요</div>
            </div>
        `;
    }

    /**
     * 시간 포맷팅
     * @param {string} isoString - ISO 시간 문자열
     * @returns {string} 포맷된 시간
     */
    formatTime(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}
