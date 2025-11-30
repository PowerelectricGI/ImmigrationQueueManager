/**
 * src/js/data/parkingFetch.js
 * 인천공항 주차장 현황 데이터 가져오기
 */

import { generateUUID } from '../utils/helpers.js';

/**
 * 주차장 데이터 Fetcher
 */
export class ParkingDataFetcher {
    // CORS 프록시 목록 (browserFetch.js와 동일)
    static CORS_PROXIES = [
        {
            name: 'AllOrigins',
            url: 'https://api.allorigins.win/raw?url=',
            enabled: true
        },
        {
            name: 'Corsproxy.io',
            url: 'https://corsproxy.io/?',
            enabled: true
        }
    ];

    // 주차장 URL
    static PARKING_URLS = {
        shortTerm: 'https://www.airport.kr/ap_ko/964/subview.do', // 단기주차장
        longTerm: 'https://www.airport.kr/ap_ko/965/subview.do'   // 장기주차장
    };

    /**
     * 단기주차장 HTML 파싱
     * @param {string} html - HTML 문자열
     * @returns {Object} 단기주차장 데이터
     */
    static parseShortTermHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 주차 현황 테이블 또는 div 찾기
        // 인천공항 페이지 구조에 따라 조정 필요
        const result = {
            floor1: { available: 0, total: 0, name: '지상 1층' },
            basement1: { available: 0, total: 0, name: '지하 1층' },
            basement2: { available: 0, total: 0, name: '지하 2층' }
        };

        try {
            // 방법 1: 테이블에서 데이터 추출 시도
            const tables = doc.querySelectorAll('table');
            for (const table of tables) {
                const rows = table.querySelectorAll('tr');
                for (const row of rows) {
                    const cells = row.querySelectorAll('td, th');
                    const text = row.textContent;

                    if (text.includes('지상') || text.includes('1층') || text.includes('1F')) {
                        const numbers = this.extractNumbers(row);
                        if (numbers.length >= 1) {
                            result.floor1.available = numbers[0];
                            if (numbers.length >= 2) result.floor1.total = numbers[1];
                        }
                    }
                    if (text.includes('지하 1') || text.includes('B1')) {
                        const numbers = this.extractNumbers(row);
                        if (numbers.length >= 1) {
                            result.basement1.available = numbers[0];
                            if (numbers.length >= 2) result.basement1.total = numbers[1];
                        }
                    }
                    if (text.includes('지하 2') || text.includes('B2')) {
                        const numbers = this.extractNumbers(row);
                        if (numbers.length >= 1) {
                            result.basement2.available = numbers[0];
                            if (numbers.length >= 2) result.basement2.total = numbers[1];
                        }
                    }
                }
            }

            // 방법 2: 특정 클래스나 ID로 찾기
            const parkingItems = doc.querySelectorAll('.parking-item, .park-info, [class*="parking"]');
            parkingItems.forEach(item => {
                const text = item.textContent;
                const numbers = this.extractNumbers(item);

                if (text.includes('지상') && numbers.length >= 1) {
                    result.floor1.available = numbers[0];
                }
                if (text.includes('지하 1') || text.includes('지하1')) {
                    if (numbers.length >= 1) result.basement1.available = numbers[0];
                }
                if (text.includes('지하 2') || text.includes('지하2')) {
                    if (numbers.length >= 1) result.basement2.available = numbers[0];
                }
            });

            // 방법 3: 숫자가 큰 span/div 요소 찾기 (주차 가능 대수는 보통 큰 숫자로 표시)
            const numberElements = doc.querySelectorAll('.num, .count, .available, [class*="num"]');
            // 구체적인 파싱은 실제 페이지 구조 확인 후 조정

        } catch (error) {
            console.error('단기주차장 파싱 오류:', error);
        }

        return result;
    }

    /**
     * 장기주차장 HTML 파싱
     * @param {string} html - HTML 문자열
     * @returns {Object} 장기주차장 데이터
     */
    static parseLongTermHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const result = {
            east: {
                p1: { available: 0, total: 0, name: '장기주차장 P1' },
                tower: { available: 0, total: 0, name: '주차타워 동편' },
                p3: { available: 0, total: 0, name: '장기주차장 P3' }
            },
            west: {
                p2: { available: 0, total: 0, name: '장기주차장 P2' },
                tower: { available: 0, total: 0, name: '주차타워 서편' },
                p4: { available: 0, total: 0, name: '장기주차장 P4' }
            }
        };

        try {
            // 테이블에서 데이터 추출
            const tables = doc.querySelectorAll('table');
            for (const table of tables) {
                const rows = table.querySelectorAll('tr');
                for (const row of rows) {
                    const text = row.textContent;
                    const numbers = this.extractNumbers(row);

                    // 동편
                    if ((text.includes('P1') || text.includes('장기주차장 P1')) && !text.includes('P1') === false) {
                        if (text.includes('P1') && !text.includes('P2')) {
                            if (numbers.length >= 1) result.east.p1.available = numbers[0];
                        }
                    }
                    if (text.includes('주차타워') && text.includes('동')) {
                        if (numbers.length >= 1) result.east.tower.available = numbers[0];
                    }
                    if (text.includes('P3')) {
                        if (numbers.length >= 1) result.east.p3.available = numbers[0];
                    }

                    // 서편
                    if (text.includes('P2') && !text.includes('P1')) {
                        if (numbers.length >= 1) result.west.p2.available = numbers[0];
                    }
                    if (text.includes('주차타워') && text.includes('서')) {
                        if (numbers.length >= 1) result.west.tower.available = numbers[0];
                    }
                    if (text.includes('P4')) {
                        if (numbers.length >= 1) result.west.p4.available = numbers[0];
                    }
                }
            }

        } catch (error) {
            console.error('장기주차장 파싱 오류:', error);
        }

        return result;
    }

    /**
     * 요소에서 숫자 추출
     * @param {Element} element - DOM 요소
     * @returns {number[]} 숫자 배열
     */
    static extractNumbers(element) {
        const text = element.textContent;
        const matches = text.match(/\d+/g);
        return matches ? matches.map(n => parseInt(n, 10)) : [];
    }

    /**
     * CORS 프록시를 통해 HTML 가져오기
     * @param {string} url - 대상 URL
     * @returns {Promise<string>} HTML 문자열
     */
    static async fetchWithProxy(url) {
        const enabledProxies = this.CORS_PROXIES.filter(p => p.enabled);

        for (const proxy of enabledProxies) {
            const proxyUrl = proxy.url + encodeURIComponent(url);
            console.log(`Fetching parking data via ${proxy.name}: ${proxyUrl}`);

            try {
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const html = await response.text();

                if (html.length < 500) {
                    throw new Error('Response too short');
                }

                return html;

            } catch (error) {
                console.warn(`${proxy.name} 실패:`, error.message);
                continue;
            }
        }

        throw new Error('모든 프록시 실패');
    }

    /**
     * 주차장 데이터 가져오기 메인 함수
     * @returns {Promise<Object>} 주차장 데이터
     */
    static async fetchParkingData() {
        const result = {
            id: generateUUID(),
            lastUpdated: new Date().toISOString(),
            shortTerm: null,
            longTerm: null,
            errors: []
        };

        // 단기주차장 데이터 가져오기
        try {
            const shortTermHtml = await this.fetchWithProxy(this.PARKING_URLS.shortTerm);
            result.shortTerm = this.parseShortTermHTML(shortTermHtml);
            console.log('단기주차장 데이터:', result.shortTerm);
        } catch (error) {
            console.error('단기주차장 데이터 가져오기 실패:', error);
            result.errors.push(`단기주차장: ${error.message}`);
            // 기본값 설정
            result.shortTerm = {
                floor1: { available: '-', total: '-', name: '지상 1층' },
                basement1: { available: '-', total: '-', name: '지하 1층' },
                basement2: { available: '-', total: '-', name: '지하 2층' }
            };
        }

        // 장기주차장 데이터 가져오기
        try {
            const longTermHtml = await this.fetchWithProxy(this.PARKING_URLS.longTerm);
            result.longTerm = this.parseLongTermHTML(longTermHtml);
            console.log('장기주차장 데이터:', result.longTerm);
        } catch (error) {
            console.error('장기주차장 데이터 가져오기 실패:', error);
            result.errors.push(`장기주차장: ${error.message}`);
            // 기본값 설정
            result.longTerm = {
                east: {
                    p1: { available: '-', total: '-', name: '장기주차장 P1' },
                    tower: { available: '-', total: '-', name: '주차타워 동편' },
                    p3: { available: '-', total: '-', name: '장기주차장 P3' }
                },
                west: {
                    p2: { available: '-', total: '-', name: '장기주차장 P2' },
                    tower: { available: '-', total: '-', name: '주차타워 서편' },
                    p4: { available: '-', total: '-', name: '장기주차장 P4' }
                }
            };
        }

        return result;
    }

    /**
     * 샘플 데이터 (테스트/폴백용)
     * @returns {Object} 샘플 주차장 데이터
     */
    static getSampleData() {
        return {
            id: generateUUID(),
            lastUpdated: new Date().toISOString(),
            shortTerm: {
                floor1: { available: 245, total: 500, name: '지상 1층' },
                basement1: { available: 189, total: 450, name: '지하 1층' },
                basement2: { available: 312, total: 600, name: '지하 2층' }
            },
            longTerm: {
                east: {
                    p1: { available: 523, total: 1200, name: '장기주차장 P1' },
                    tower: { available: 156, total: 800, name: '주차타워 동편' },
                    p3: { available: 789, total: 1500, name: '장기주차장 P3' }
                },
                west: {
                    p2: { available: 445, total: 1100, name: '장기주차장 P2' },
                    tower: { available: 201, total: 750, name: '주차타워 서편' },
                    p4: { available: 612, total: 1400, name: '장기주차장 P4' }
                }
            },
            errors: [],
            isSample: true
        };
    }
}
