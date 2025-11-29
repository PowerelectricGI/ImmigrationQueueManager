/**
 * src/js/data/sampleData.js
 * 테스트용 샘플 데이터 (인천공항 실제 형식 기반)
 */

import { generateUUID } from '../utils/helpers.js';

// 인천공항 실제 데이터 형식 기반 24시간 샘플
const hourlyDataFull = [
  { hour: "00~01", hourStart: 0, arrival: { AB: 541, C: 0, D: 0, EF: 0, total: 541 }, departure: { AB: 0, C: 724, D: 0, EF: 0, total: 724 } },
  { hour: "01~02", hourStart: 1, arrival: { AB: 510, C: 0, D: 0, EF: 0, total: 510 }, departure: { AB: 0, C: 126, D: 0, EF: 0, total: 126 } },
  { hour: "02~03", hourStart: 2, arrival: { AB: 208, C: 0, D: 0, EF: 0, total: 208 }, departure: { AB: 0, C: 44, D: 0, EF: 0, total: 44 } },
  { hour: "03~04", hourStart: 3, arrival: { AB: 0, C: 0, D: 0, EF: 0, total: 0 }, departure: { AB: 0, C: 307, D: 0, EF: 0, total: 307 } },
  { hour: "04~05", hourStart: 4, arrival: { AB: 1508, C: 0, D: 0, EF: 0, total: 1508 }, departure: { AB: 0, C: 1410, D: 0, EF: 0, total: 1410 } },
  { hour: "05~06", hourStart: 5, arrival: { AB: 1486, C: 0, D: 0, EF: 350, total: 1836 }, departure: { AB: 0, C: 2017, D: 0, EF: 937, total: 2954 } },
  { hour: "06~07", hourStart: 6, arrival: { AB: 2064, C: 329, D: 323, EF: 1392, total: 4108 }, departure: { AB: 1232, C: 1531, D: 536, EF: 1143, total: 4442 } },
  { hour: "07~08", hourStart: 7, arrival: { AB: 1539, C: 348, D: 352, EF: 2334, total: 4573 }, departure: { AB: 2145, C: 1327, D: 1079, EF: 1419, total: 5970 } },
  { hour: "08~09", hourStart: 8, arrival: { AB: 1265, C: 37, D: 37, EF: 1410, total: 2749 }, departure: { AB: 1586, C: 1457, D: 1149, EF: 1717, total: 5909 } },
  { hour: "09~10", hourStart: 9, arrival: { AB: 876, C: 140, D: 41, EF: 946, total: 2003 }, departure: { AB: 1223, C: 1192, D: 1434, EF: 1587, total: 5436 } },
  { hour: "10~11", hourStart: 10, arrival: { AB: 312, C: 343, D: 159, EF: 1134, total: 1948 }, departure: { AB: 1360, C: 1006, D: 1550, EF: 1529, total: 5445 } },
  { hour: "11~12", hourStart: 11, arrival: { AB: 819, C: 781, D: 260, EF: 1325, total: 3185 }, departure: { AB: 895, C: 764, D: 991, EF: 1345, total: 3995 } },
  { hour: "12~13", hourStart: 12, arrival: { AB: 426, C: 852, D: 562, EF: 1490, total: 3330 }, departure: { AB: 793, C: 681, D: 892, EF: 1128, total: 3494 } },
  { hour: "13~14", hourStart: 13, arrival: { AB: 1287, C: 291, D: 288, EF: 848, total: 2714 }, departure: { AB: 722, C: 812, D: 963, EF: 1100, total: 3597 } },
  { hour: "14~15", hourStart: 14, arrival: { AB: 1779, C: 264, D: 264, EF: 2458, total: 4765 }, departure: { AB: 690, C: 609, D: 863, EF: 746, total: 2908 } },
  { hour: "15~16", hourStart: 15, arrival: { AB: 1244, C: 451, D: 455, EF: 1349, total: 3499 }, departure: { AB: 592, C: 577, D: 608, EF: 768, total: 2545 } },
  { hour: "16~17", hourStart: 16, arrival: { AB: 1475, C: 317, D: 314, EF: 2112, total: 4218 }, departure: { AB: 843, C: 740, D: 634, EF: 640, total: 2857 } },
  { hour: "17~18", hourStart: 17, arrival: { AB: 2222, C: 137, D: 276, EF: 1931, total: 4566 }, departure: { AB: 1142, C: 805, D: 714, EF: 723, total: 3384 } },
  { hour: "18~19", hourStart: 18, arrival: { AB: 1499, C: 221, D: 214, EF: 1527, total: 3461 }, departure: { AB: 940, C: 733, D: 832, EF: 1133, total: 3638 } },
  { hour: "19~20", hourStart: 19, arrival: { AB: 1988, C: 492, D: 193, EF: 1942, total: 4615 }, departure: { AB: 647, C: 625, D: 865, EF: 1103, total: 3240 } },
  { hour: "20~21", hourStart: 20, arrival: { AB: 686, C: 773, D: 203, EF: 1682, total: 3344 }, departure: { AB: 0, C: 1493, D: 0, EF: 728, total: 2221 } },
  { hour: "21~22", hourStart: 21, arrival: { AB: 1396, C: 827, D: 473, EF: 1667, total: 4363 }, departure: { AB: 0, C: 797, D: 0, EF: 332, total: 1129 } },
  { hour: "22~23", hourStart: 22, arrival: { AB: 2251, C: 0, D: 0, EF: 1813, total: 4064 }, departure: { AB: 0, C: 336, D: 0, EF: 0, total: 336 } },
  { hour: "23~00", hourStart: 23, arrival: { AB: 681, C: 0, D: 0, EF: 0, total: 681 }, departure: { AB: 0, C: 9, D: 0, EF: 0, total: 9 } }
];

export const SampleForecast = {
  id: generateUUID(),
  date: new Date().toISOString().split('T')[0],
  terminal: "T1",
  lastUpdated: new Date().toISOString(),
  source: "sample",
  hourlyData: hourlyDataFull
};

/**
 * 24시간 전체 샘플 데이터 생성 (랜덤)
 */
export function generateFullDaySample() {
  const data = [];
  for (let i = 0; i < 24; i++) {
    const hourStr = `${String(i).padStart(2, '0')}~${String((i + 1) % 24).padStart(2, '0')}`;

    // 피크 시간대 시뮬레이션
    let baseLoad = 500;
    if (i >= 6 && i <= 9) baseLoad = 4000;
    if (i >= 14 && i <= 15) baseLoad = 3500;
    if (i >= 17 && i <= 19) baseLoad = 3500;

    const randomFactor = () => 0.8 + Math.random() * 0.4;

    const arrAB = Math.floor(baseLoad * 0.35 * randomFactor());
    const arrC = Math.floor(baseLoad * 0.1 * randomFactor());
    const arrD = Math.floor(baseLoad * 0.1 * randomFactor());
    const arrEF = Math.floor(baseLoad * 0.45 * randomFactor());

    const depAB = Math.floor(baseLoad * 0.3 * randomFactor());
    const depC = Math.floor(baseLoad * 0.25 * randomFactor());
    const depD = Math.floor(baseLoad * 0.2 * randomFactor());
    const depEF = Math.floor(baseLoad * 0.25 * randomFactor());

    data.push({
      hour: hourStr,
      hourStart: i,
      arrival: {
        AB: arrAB,
        C: arrC,
        D: arrD,
        EF: arrEF,
        total: arrAB + arrC + arrD + arrEF
      },
      departure: {
        AB: depAB,
        C: depC,
        D: depD,
        EF: depEF,
        total: depAB + depC + depD + depEF
      }
    });
  }

  return {
    id: generateUUID(),
    date: new Date().toISOString().split('T')[0],
    terminal: "T1",
    lastUpdated: new Date().toISOString(),
    source: "generated",
    hourlyData: data
  };
}
