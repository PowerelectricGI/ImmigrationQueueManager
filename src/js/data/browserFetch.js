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
     * 옵션 2: Corsproxy.io
     * - URL: https://corsproxy.io/?
     * - 장점: 빠름, 무료
     *
     * 옵션 3: CORS Anywhere (백업)
     * - URL: https://cors-anywhere.herokuapp.com/
     * - 장점: 간단
     * - 단점: 사용 전 활성화 필요 (https://cors-anywhere.herokuapp.com/corsdemo)
     *
     * 옵션 4: 직접 호스팅
     * - 자체 CORS 프록시 서버 운영
     */
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
        },
        {
            name: 'CORS Anywhere',
            url: 'https://cors-anywhere.herokuapp.com/',
            enabled: false // 기본 비활성화 (활성화 필요: https://cors-anywhere.herokuapp.com/corsdemo)
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
     * 정적 데이터 로드 (여러 경로 시도)
     * @returns {Promise<Object>} 정적 데이터
     */
    static async loadStaticFallback() {
        const staticPaths = [
            'src/data/latest_data.json',
            './src/data/latest_data.json',
            '/ImmigrationQueueManager/src/data/latest_data.json'
        ];

        for (const path of staticPaths) {
            try {
                console.log(`Trying static fallback: ${path}`);
                const response = await fetch(path);

                if (response.ok) {
                    const data = await response.json();
                    console.log('Static data loaded successfully from:', path);
                    return {
                        ...data,
                        id: generateUUID(),
                        source: 'static-fallback'
                    };
                }
            } catch (error) {
                console.warn(`Static fallback failed for ${path}:`, error.message);
            }
        }

        throw new Error('정적 데이터를 로드할 수 없습니다');
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

        // 활성화된 프록시 목록
        const enabledProxies = this.CORS_PROXIES.filter(p => p.enabled);

        if (enabledProxies.length === 0) {
            console.warn('사용 가능한 CORS 프록시가 없습니다. 정적 데이터로 fallback합니다.');
            return await this.loadStaticFallback();
        }

        let lastError = null;

        // 각 프록시를 순차적으로 시도
        const timestamp = new Date().getTime(); // Cache buster

        for (const proxy of enabledProxies) {
            // Append timestamp to the original URL or the proxy URL to ensure uniqueness
            const separator = targetUrl.includes('?') ? '&' : '?';
            const urlWithCacheBuster = `${targetUrl}${separator}_t=${timestamp}`;

            const proxyUrl = proxy.url + encodeURIComponent(urlWithCacheBuster);
            console.log(`Fetching via ${proxy.name}: ${proxyUrl}`);

            try {
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const html = await response.text();

                // HTML이 너무 짧으면 실패로 간주
                if (html.length < 1000) {
                    throw new Error('Response too short, likely blocked or error page');
                }

                const result = this.parseAirportHTML(html, date);
                console.log(`Successfully fetched data via ${proxy.name}`);
                return result;

            } catch (error) {
                console.warn(`${proxy.name} 프록시 실패:`, error.message);
                lastError = error;
                // 다음 프록시 시도
                continue;
            }
        }

        // 모든 프록시 실패 - 정적 데이터로 fallback
        console.warn('모든 CORS 프록시 실패. 정적 데이터로 fallback합니다.');
        console.warn('마지막 에러:', lastError?.message);

        try {
            return await this.loadStaticFallback();
        } catch (fallbackError) {
            throw new Error(`데이터 가져오기 실패: ${lastError?.message || 'Unknown error'}. 정적 데이터도 로드할 수 없습니다.`);
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
