/**
 * src/js/data/importer.js
 * 데이터 가져오기 모듈 (CSV 파서)
 */

import { generateUUID } from '../utils/helpers.js';
import { BrowserDataFetcher } from './browserFetch.js';

export class AirportDataImporter {
    /**
     * CSV 문자열 파싱
     * 
     * 예상 형식 (헤더 포함):
     * 시간,입국_AB,입국_C,입국_D,입국_EF,입국_합계,출국_12,출국_3,출국_4,출국_56,출국_합계
     * 00~01,541,0,0,0,541,0,724,0,0,724
     * ...
     * 
     * @param {string} csvString - CSV 문자열
     * @param {Object} options - 파싱 옵션 (date, terminal 등)
     * @returns {Object} PassengerForecast 객체
     */
    static parseCSV(csvString, options = {}) {
        const {
            date = new Date().toISOString().split('T')[0],
            terminal = 'T1'
        } = options;

        if (!csvString || typeof csvString !== 'string') {
            throw new Error('유효하지 않은 CSV 데이터입니다.');
        }

        const lines = csvString.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('데이터가 충분하지 않습니다 (헤더 또는 데이터 누락).');
        }

        // 헤더 파싱 및 인덱스 매핑 (유연한 처리를 위해)
        const headers = lines[0].split(',').map(h => h.trim());

        // 필수 컬럼 확인
        // 실제 CSV 헤더가 정확히 일치하지 않을 수 있으므로 키워드로 찾기
        // 예: "입국_AB" 또는 "입국(A,B)" 등 변형 대응을 위해 인덱스 찾기 로직이 필요할 수 있으나,
        // 여기서는 LLD 명세의 표준 포맷을 따른다고 가정하고, 인덱스 매핑을 생성합니다.

        const colMap = {
            hour: headers.findIndex(h => h.includes('시간')),
            arrAB: headers.findIndex(h => h.includes('입국') && (h.includes('AB') || h.includes('A,B'))),
            arrC: headers.findIndex(h => h.includes('입국') && h.includes('C')),
            arrD: headers.findIndex(h => h.includes('입국') && h.includes('D')),
            arrEF: headers.findIndex(h => h.includes('입국') && (h.includes('EF') || h.includes('E,F'))),
            arrTotal: headers.findIndex(h => h.includes('입국') && h.includes('합계')),
            dep12: headers.findIndex(h => h.includes('출국') && (h.includes('12') || h.includes('1,2'))),
            dep3: headers.findIndex(h => h.includes('출국') && h.includes('3')),
            dep4: headers.findIndex(h => h.includes('출국') && h.includes('4')),
            dep56: headers.findIndex(h => h.includes('출국') && (h.includes('56') || h.includes('5,6'))),
            depTotal: headers.findIndex(h => h.includes('출국') && h.includes('합계'))
        };

        // 필수 컬럼 중 하나라도 없으면 에러 (시간은 필수)
        if (colMap.hour === -1) {
            throw new Error('CSV 형식 오류: "시간" 컬럼을 찾을 수 없습니다.');
        }

        const hourlyData = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(v => v.trim());

            // 시간 파싱 (예: "07~08")
            const hourStr = values[colMap.hour];
            const hourMatch = hourStr?.match(/(\d{1,2})~(\d{1,2})/);

            if (!hourMatch) {
                console.warn(`Line ${i + 1}: 유효하지 않은 시간 형식 (${hourStr}), 건너뜁니다.`);
                continue;
            }

            const hourStart = parseInt(hourMatch[1], 10);

            // 숫자 파싱 헬퍼
            const parseNum = (idx) => {
                if (idx === -1 || !values[idx]) return 0;
                return parseInt(values[idx].replace(/,/g, ''), 10) || 0;
            };

            hourlyData.push({
                hour: hourStr,
                hourStart: hourStart,
                arrival: {
                    AB: parseNum(colMap.arrAB),
                    C: parseNum(colMap.arrC),
                    D: parseNum(colMap.arrD),
                    EF: parseNum(colMap.arrEF),
                    total: parseNum(colMap.arrTotal)
                },
                departure: {
                    AB: parseNum(colMap.dep12), // 1,2 구역을 AB 키에 매핑 (내부 로직 통일성)
                    C: parseNum(colMap.dep3),
                    D: parseNum(colMap.dep4),
                    EF: parseNum(colMap.dep56), // 5,6 구역을 EF 키에 매핑
                    total: parseNum(colMap.depTotal)
                }
            });
        }

        if (hourlyData.length === 0) {
            throw new Error('유효한 데이터 행이 없습니다.');
        }

        return {
            id: generateUUID(),
            date,
            terminal,
            lastUpdated: new Date().toISOString(),
            source: 'csv',
            hourlyData
        };
    }

    /**
     * 파일 객체로부터 데이터 가져오기
     * @param {File} file - 업로드된 파일 객체
     * @returns {Promise<Object>} 파싱된 데이터
     */
    static async importFromFile(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('파일이 선택되지 않았습니다.'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const result = this.parseCSV(e.target.result, {
                        // 파일명에서 날짜 추출 시도 (예: 20240115_forecast.csv)
                        date: this.extractDateFromFilename(file.name) || new Date().toISOString().split('T')[0]
                    });
                    resolve(result);
                } catch (error) {
                    reject(new Error(`파일 파싱 실패: ${error.message}`));
                }
            };

            reader.onerror = () => reject(new Error('파일 읽기 중 오류가 발생했습니다.'));
            reader.readAsText(file, 'UTF-8'); // EUC-KR이 필요할 수도 있으나 일단 UTF-8 가정
        });
    }

    static extractDateFromFilename(filename) {
        const match = filename.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
        return null;
    }

    /**
     * API로부터 데이터 가져오기 (Proxy Server 경유)
     * @param {string} date - YYYYMMDD 형식의 날짜 (옵션)
     * @returns {Promise<Object>} 파싱된 데이터
     */
    static async fetchFromApi(date) {
        // 서버리스 구조이므로 항상 BrowserDataFetcher (CORS Proxy) 사용
        console.log('Fetching live data via BrowserDataFetcher...');
        try {
            return await BrowserDataFetcher.fetchFromBrowser(date);
        } catch (error) {
            console.warn('Browser fetch failed, trying static fallback...', error);

            // Fallback to static data
            try {
                const staticResponse = await fetch('src/data/latest_data.json');
                if (!staticResponse.ok) {
                    throw new Error('Static data not found');
                }
                const staticData = await staticResponse.json();

                return {
                    ...staticData,
                    id: generateUUID(),
                    source: 'static-fallback'
                };
            } catch (staticError) {
                throw new Error(`데이터 가져오기 실패: ${error.message}. 정적 데이터도 로드할 수 없습니다.`);
            }
        }
    }
}
