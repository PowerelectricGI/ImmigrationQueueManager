/**
 * src/js/data/parkingFetch.js
 * 인천공항 주차장 현황 데이터 가져오기
 */

import { generateUUID } from '../utils/helpers.js';

/**
 * 주차장 데이터 Fetcher
 */
export class ParkingDataFetcher {
    // CORS 프록시 목록
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
     * XPath로 요소 찾기 (브라우저 환경)
     * @param {Document} doc - DOM Document
     * @param {string} xpath - XPath 문자열
     * @returns {string|null} 텍스트 내용
     */
    static getTextByXPath(doc, xpath) {
        try {
            const result = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            if (result.singleNodeValue) {
                return result.singleNodeValue.textContent.trim();
            }
        } catch (e) {
            console.warn('XPath evaluation failed:', xpath, e);
        }
        return null;
    }

    /**
     * CSS 선택자로 요소 찾기 (XPath 대체)
     * @param {Document} doc - DOM Document
     * @param {string} selector - CSS 선택자
     * @returns {string|null} 텍스트 내용
     */
    static getTextBySelector(doc, selector) {
        try {
            const element = doc.querySelector(selector);
            if (element) {
                return element.textContent.trim();
            }
        } catch (e) {
            console.warn('Selector failed:', selector, e);
        }
        return null;
    }

    /**
     * 숫자 추출
     * @param {string} text - 텍스트
     * @returns {number} 숫자 (없으면 0)
     */
    static extractNumber(text) {
        if (!text) return 0;
        const match = text.replace(/,/g, '').match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
    }

    /**
     * 단기주차장 HTML 파싱
     * XPath 기반:
     * - 지상 1층: //*[@id="menu964_obj1181"]/div/div[4]/ul/li[1]/div/div[2]/div[1]
     * - 지하 1층: //*[@id="menu964_obj1181"]/div/div[4]/ul/li[2]/div/div[2]/div[1]
     * - 지하 2층: //*[@id="menu964_obj1181"]/div/div[4]/ul/li[3]/div/div[2]/div[1]
     * 
     * @param {string} html - HTML 문자열
     * @returns {Object} 단기주차장 데이터
     */
    static parseShortTermHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const result = {
            floor1: { available: 0, name: '지상 1층' },
            basement1: { available: 0, name: '지하 1층' },
            basement2: { available: 0, name: '지하 2층' }
        };

        try {
            // CSS 선택자로 변환 (XPath 대응)
            // #menu964_obj1181 > div > div:nth-child(4) > ul > li:nth-child(N) > div > div:nth-child(2) > div:first-child
            const baseSelector = '#menu964_obj1181';

            // 지상 1층
            const floor1Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(1) > div > div:nth-child(2) > div:first-child`
            ) || this.getTextBySelector(doc,
                `${baseSelector} div > div:nth-of-type(4) ul li:nth-child(1) div div:nth-of-type(2) div:first-child`
            );
            result.floor1.available = this.extractNumber(floor1Text);

            // 지하 1층
            const basement1Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(2) > div > div:nth-child(2) > div:first-child`
            ) || this.getTextBySelector(doc,
                `${baseSelector} div > div:nth-of-type(4) ul li:nth-child(2) div div:nth-of-type(2) div:first-child`
            );
            result.basement1.available = this.extractNumber(basement1Text);

            // 지하 2층
            const basement2Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(3) > div > div:nth-child(2) > div:first-child`
            ) || this.getTextBySelector(doc,
                `${baseSelector} div > div:nth-of-type(4) ul li:nth-child(3) div div:nth-of-type(2) div:first-child`
            );
            result.basement2.available = this.extractNumber(basement2Text);

            // 대체 방법: li 요소들을 순회하며 찾기
            if (result.floor1.available === 0 && result.basement1.available === 0) {
                const container = doc.querySelector('#menu964_obj1181');
                if (container) {
                    const listItems = container.querySelectorAll('ul li');
                    listItems.forEach((li, index) => {
                        // div > div:nth-child(2) > div:first-child 에서 숫자 찾기
                        const numDiv = li.querySelector('div > div:nth-child(2) > div:first-child') ||
                            li.querySelector('div div:nth-of-type(2) div:first-child');
                        if (numDiv) {
                            const num = this.extractNumber(numDiv.textContent);
                            if (index === 0) result.floor1.available = num;
                            else if (index === 1) result.basement1.available = num;
                            else if (index === 2) result.basement2.available = num;
                        }
                    });
                }
            }

            console.log('단기주차장 파싱 결과:', result);

        } catch (error) {
            console.error('단기주차장 파싱 오류:', error);
        }

        return result;
    }

    /**
     * 장기주차장 HTML 파싱
     * XPath 기반:
     * 동편 (div[4]):
     * - 장기주차장 P1: //*[@id="menu965_obj1182"]/div/div[4]/ul/li[1]/div/div[2]/div[1]
     * - 주차타워 동편: //*[@id="menu965_obj1182"]/div/div[4]/ul/li[2]/div/div[2]/div[1]
     * - 장기주차장 P3: //*[@id="menu965_obj1182"]/div/div[4]/ul/li[3]/div/div[2]/div[1]
     * 서편 (div[5]):
     * - 장기주차 P2: //*[@id="menu965_obj1182"]/div/div[5]/ul/li[1]/div/div[2]/div[1]
     * - 주차타워 서편: //*[@id="menu965_obj1182"]/div/div[5]/ul/li[2]/div/div[2]/div[1]
     * - 장기주차 P4: //*[@id="menu965_obj1182"]/div/div[5]/ul/li[3]/div/div[2]/div[1]
     * 
     * @param {string} html - HTML 문자열
     * @returns {Object} 장기주차장 데이터
     */
    static parseLongTermHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const result = {
            east: {
                p1: { available: 0, name: '장기주차장 P1' },
                tower: { available: 0, name: '주차타워 동편' },
                p3: { available: 0, name: '장기주차장 P3' }
            },
            west: {
                p2: { available: 0, name: '장기주차장 P2' },
                tower: { available: 0, name: '주차타워 서편' },
                p4: { available: 0, name: '장기주차장 P4' }
            }
        };

        try {
            const baseSelector = '#menu965_obj1182';

            // 동편 (div:nth-child(4))
            // 장기주차장 P1
            const p1Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(1) > div > div:nth-child(2) > div:first-child`
            );
            result.east.p1.available = this.extractNumber(p1Text);

            // 주차타워 동편
            const towerEastText = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(2) > div > div:nth-child(2) > div:first-child`
            );
            result.east.tower.available = this.extractNumber(towerEastText);

            // 장기주차장 P3
            const p3Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(4) > ul > li:nth-child(3) > div > div:nth-child(2) > div:first-child`
            );
            result.east.p3.available = this.extractNumber(p3Text);

            // 서편 (div:nth-child(5))
            // 장기주차장 P2
            const p2Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(5) > ul > li:nth-child(1) > div > div:nth-child(2) > div:first-child`
            );
            result.west.p2.available = this.extractNumber(p2Text);

            // 주차타워 서편
            const towerWestText = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(5) > ul > li:nth-child(2) > div > div:nth-child(2) > div:first-child`
            );
            result.west.tower.available = this.extractNumber(towerWestText);

            // 장기주차장 P4
            const p4Text = this.getTextBySelector(doc,
                `${baseSelector} > div > div:nth-child(5) > ul > li:nth-child(3) > div > div:nth-child(2) > div:first-child`
            );
            result.west.p4.available = this.extractNumber(p4Text);

            // 대체 방법: 컨테이너에서 직접 찾기
            if (result.east.p1.available === 0 && result.west.p2.available === 0) {
                const container = doc.querySelector('#menu965_obj1182');
                if (container) {
                    const divs = container.querySelectorAll(':scope > div > div');

                    divs.forEach((div, divIndex) => {
                        const listItems = div.querySelectorAll('ul li');
                        if (listItems.length >= 3) {
                            listItems.forEach((li, liIndex) => {
                                const numDiv = li.querySelector('div > div:nth-child(2) > div:first-child') ||
                                    li.querySelector('div div:nth-of-type(2) div:first-child');
                                if (numDiv) {
                                    const num = this.extractNumber(numDiv.textContent);

                                    // div[4] = index 3 (동편), div[5] = index 4 (서편)
                                    if (divIndex === 3) { // 동편
                                        if (liIndex === 0) result.east.p1.available = num;
                                        else if (liIndex === 1) result.east.tower.available = num;
                                        else if (liIndex === 2) result.east.p3.available = num;
                                    } else if (divIndex === 4) { // 서편
                                        if (liIndex === 0) result.west.p2.available = num;
                                        else if (liIndex === 1) result.west.tower.available = num;
                                        else if (liIndex === 2) result.west.p4.available = num;
                                    }
                                }
                            });
                        }
                    });
                }
            }

            console.log('장기주차장 파싱 결과:', result);

        } catch (error) {
            console.error('장기주차장 파싱 오류:', error);
        }

        return result;
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
        try {
            // GitHub Pages 환경을 고려하여 상대 경로 사용
            // index.html이 root에 있고 data는 src/data에 있음
            const response = await fetch('src/data/parking_data.json');

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Loaded parking data from static file:', data);
            return data;

        } catch (error) {
            console.error('주차장 데이터 로드 실패:', error);
            return {
                ...this.getSampleData(),
                errors: [`데이터 로드 실패: ${error.message}`]
            };
        }
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
                floor1: { available: 245, name: '지상 1층' },
                basement1: { available: 189, name: '지하 1층' },
                basement2: { available: 312, name: '지하 2층' }
            },
            longTerm: {
                east: {
                    p1: { available: 523, name: '장기주차장 P1' },
                    tower: { available: 156, name: '주차타워 동편' },
                    p3: { available: 789, name: '장기주차장 P3' }
                },
                west: {
                    p2: { available: 445, name: '장기주차장 P2' },
                    tower: { available: 201, name: '주차타워 서편' },
                    p4: { available: 612, name: '장기주차장 P4' }
                }
            },
            errors: [],
            isSample: true
        };
    }
}
