/**
 * src/js/data/browserFetch.js
 * 브라우저에서 직접 데이터 가져오기 (CORS 프록시 사용)
 */

import { generateUUID } from '../utils/helpers.js';

/**
 * CORS 프록시를 통해 공항 데이터 가져오기
 *
 * 주의: CORS 프록시 서비스는 안정성이 보장되지 않으며,
 * 프로덕션 환경에서는 자체 백엔드 서버 사용 권장
 */
export class BrowserDataFetcher {
    /**
     * 사용 가능한 CORS 프록시 목록
     *
     * 옵션 1: AllOrigins (추천)
     * - URL: https://api.allorigins.win/raw?url=
     * - 장점: 안정적, 무료
     * - 단점: 속도 제한 있음
     *
     * 옵션 2: CORS Anywhere (백업)
     * - URL: https://cors-anywhere.herokuapp.com/
     * - 장점: 간단
     * - 단점: 사용 전 활성화 필요 (https://cors-anywhere.herokuapp.com/corsdemo)
     *
     * 옵션 3: 직접 호스팅
     * - 자체 CORS 프록시 서버 운영
     */
    static CORS_PROXIES = [
        {
            name: 'AllOrigins',
            url: 'https://api.allorigins.win/raw?url=',
            enabled: true
        },
        {
            name: 'CORS Anywhere',
            url: 'https://cors-anywhere.herokuapp.com/',
            enabled: false, // 기본 비활성화 (활성화 필요)
        }
    ];

    /**
     * HTML 파싱하여 데이터 추출
     * @param {string} html - HTML 문자열
     * @param {string} date - 요청한 날짜 (YYYYMMDD)
     * @returns {Object} PassengerForecast 객체
     */
    static parseAirportHTML(html, date = null) {
        // DOM Parser 생성
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // id="userEx" 테이블 찾기
        let table = doc.querySelector('table#userEx');

        if (!table) {
            // Fallback: 충분한 행이 있는 테이블 찾기
            const tables = doc.querySelectorAll('table');
            for (const t of tables) {
                const tbody = t.querySelector('tbody') || t;
                if (tbody.querySelectorAll('tr').length > 10) {
                    table = t;
                    break;
                }
            }
        }

        if (!table) {
            throw new Error('유효한 데이터 테이블을 찾을 수 없습니다 (id="userEx")');
        }

        const tbody = table.querySelector('tbody') || table;
        const rows = tbody.querySelectorAll('tr');
        const hourlyData = [];

        for (const row of rows) {
            const cells = row.querySelectorAll('td, th');

            if (cells.length < 12) continue;

            // 셀 텍스트 추출 및 정리
            const cellTexts = Array.from(cells).map(cell =>
                cell.textContent.trim().replace(/,/g, '')
            );

            const hour = cellTexts[0].replace('시', '');

            // 합계 행 제외
            if (hour.includes('합') || hour.includes('계') || hour.includes('Total')) {
                continue;
            }

            // 숫자 변환 헬퍼
            const toInt = (val) => {
                const num = parseInt(val, 10);
                return isNaN(num) ? 0 : num;
            };

            // 시간 파싱 (예: "00~01" → 0)
            let hourStart = 0;
            const hourMatch = hour.match(/(\d+)/);
            if (hourMatch) {
                hourStart = parseInt(hourMatch[1], 10);
            }

            hourlyData.push({
                hour: hour,
                hourStart: hourStart,
                arrival: {
                    AB: toInt(cellTexts[1]),
                    C: toInt(cellTexts[2]),
                    D: toInt(cellTexts[3]),
                    EF: toInt(cellTexts[4]),
                    total: toInt(cellTexts[5])
                },
                departure: {
                    AB: toInt(cellTexts[6]) + toInt(cellTexts[7]), // 1+2 구역
                    C: toInt(cellTexts[8]),
                    D: toInt(cellTexts[9]),
                    EF: toInt(cellTexts[10]),
                    total: toInt(cellTexts[11])
                }
            });
        }

        if (hourlyData.length === 0) {
            throw new Error('유효한 데이터 행을 찾을 수 없습니다');
        }

        // 날짜 처리
        let responseDate = new Date().toISOString().split('T')[0];
        if (date && date.length === 8) {
            responseDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
        }

        return {
            id: generateUUID(),
            date: responseDate,
            terminal: 'T1',
            lastUpdated: new Date().toISOString(),
            source: 'browser-cors',
            hourlyData: hourlyData
        };
    }

    /**
     * CORS 프록시를 통해 공항 데이터 가져오기
     * @param {string} date - YYYYMMDD 형식 날짜 (옵션)
     * @returns {Promise<Object>} 파싱된 데이터
     */
    static async fetchFromBrowser(date = null) {
        const baseUrl = 'https://www.airport.kr/ap_ko/883/subview.do';
        let targetUrl = baseUrl;

        if (date) {
            targetUrl += `?pday=${date}`;
        }

        // 활성화된 프록시 찾기
        const enabledProxy = this.CORS_PROXIES.find(p => p.enabled);

        if (!enabledProxy) {
            throw new Error('사용 가능한 CORS 프록시가 없습니다. CORS_PROXIES 설정을 확인하세요.');
        }

        const proxyUrl = enabledProxy.url + encodeURIComponent(targetUrl);

        console.log(`Fetching via ${enabledProxy.name}: ${proxyUrl}`);

        try {
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const html = await response.text();
            return this.parseAirportHTML(html, date);

        } catch (error) {
            console.error(`${enabledProxy.name} 프록시 실패:`, error);

            // Fallback: 정적 데이터 시도
            try {
                console.log('Fallback to static data...');
                const staticResponse = await fetch('src/data/latest_data.json');

                if (!staticResponse.ok) {
                    throw new Error('Static data not available');
                }

                const staticData = await staticResponse.json();
                return {
                    ...staticData,
                    id: generateUUID(),
                    source: 'static-fallback'
                };
            } catch (fallbackError) {
                console.error('Static fallback also failed:', fallbackError);
                throw new Error(`데이터 가져오기 실패: ${error.message}`);
            }
        }
    }

    /**
     * CORS 프록시 활성화/비활성화
     * @param {string} proxyName - 프록시 이름
     * @param {boolean} enabled - 활성화 여부
     */
    static setProxyEnabled(proxyName, enabled) {
        const proxy = this.CORS_PROXIES.find(p => p.name === proxyName);
        if (proxy) {
            proxy.enabled = enabled;
            console.log(`${proxyName} proxy ${enabled ? 'enabled' : 'disabled'}`);
        }
    }

    /**
     * 사용 가능한 프록시 목록 확인
     * @returns {Array} 활성화된 프록시 목록
     */
    static getEnabledProxies() {
        return this.CORS_PROXIES.filter(p => p.enabled);
    }
}
