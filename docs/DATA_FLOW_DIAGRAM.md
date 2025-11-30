# 데이터 흐름 다이어그램

## 📊 "Fetch Live Data" 버튼 클릭 시 흐름

```
사용자 클릭 "Fetch Live Data"
          ↓
    app.js (204줄)
          ↓
AirportDataImporter.fetchFromApi(날짜)
          ↓
fetch('/api/airport-data?date=YYYYMMDD')
          ↓
    ┌─────────────────┐
    │ Python 서버 체크 │
    └─────────────────┘
           ↓
    ┌─────┴─────┐
    ↓           ↓
[실행 중]    [실행 안됨]
    ↓           ↓
```

### 경로 A: Python 서버 실행 중 ✅

```
1. server.py가 요청 받음
   ↓
2. 인천공항 사이트 접속
   https://www.airport.kr/ap_ko/883/subview.do?pday=YYYYMMDD
   ↓
3. 실시간 HTML 크롤링
   ↓
4. BeautifulSoup로 파싱
   - table#userEx 찾기
   - 24시간 데이터 추출
   ↓
5. JSON 변환 후 브라우저에 반환
   ↓
6. ✅ 실시간 최신 데이터 표시!
   - 소요 시간: 2-5초
   - 데이터: 방금 크롤링한 최신 데이터
```

### 경로 B: Python 서버 없음 ❌→✅

```
1. fetch('/api/airport-data') 시도
   ↓
2. 실패! (ERR_CONNECTION_REFUSED 또는 404)
   ↓
3. catch 블록 실행
   ↓
4. Fallback: 정적 파일 시도
   fetch('src/data/latest_data.json')
   ↓
5. ✅ 정적 JSON 파일 반환
   - 소요 시간: <1초
   - 데이터: GitHub Actions가 마지막 업데이트한 데이터
   - 지연: 최대 1시간
```

## 🔄 GitHub Actions의 역할

GitHub Actions는 **서버 없이도 작동하게 하기 위한 백업 메커니즘**입니다.

```
GitHub Actions 워크플로우
          ↓
  매시간 정각 실행 (cron: '0 * * * *')
          ↓
  scripts/update_data.py 실행
          ↓
  인천공항 사이트 크롤링
          ↓
  src/data/latest_data.json 업데이트
          ↓
  Git 커밋 & 푸시
          ↓
  저장소에 최신 데이터 저장
```

**이렇게 하면:**
- GitHub Pages에 배포 가능
- Python 서버 없이도 작동
- 단, 최대 1시간 지연

## 📋 시나리오별 동작

### 시나리오 1: 로컬 개발 (추천)

```bash
# Python 서버 실행
python server.py
```

**결과:**
- ✅ "Fetch Live Data" → 즉시 크롤링 → 실시간 데이터
- ✅ 날짜 선택 가능 (오늘/내일/모레)
- ⏱️ 응답 시간: 2-5초

### 시나리오 2: 정적 호스팅 (GitHub Pages)

```bash
# 서버 없음, 정적 파일만
python -m http.server 8080
```

**결과:**
- ⚠️ "Fetch Live Data" → latest_data.json 읽기
- ❌ 실시간 아님 (마지막 Actions 실행 시점)
- ❌ 날짜 선택 무의미 (항상 같은 파일)
- ⏱️ 응답 시간: <1초

### 시나리오 3: CORS 프록시 사용

```javascript
// importer.js 수정
import { BrowserDataFetcher } from './browserFetch.js';

static async fetchFromApi(date) {
    return await BrowserDataFetcher.fetchFromBrowser(date);
}
```

**결과:**
- ✅ 서버 없이도 실시간 크롤링
- ✅ 날짜 선택 가능
- ⚠️ 외부 프록시 서비스 의존
- ⏱️ 응답 시간: 3-10초

## 💡 코드 분석

### server.py의 역할

```python
# server.py 17-28줄
def do_GET(self):
    if self.path.startswith('/api/airport-data'):
        self.handle_airport_data()  # ← 즉시 크롤링!
    else:
        super().do_GET()  # ← 정적 파일 서빙
```

**즉시 크롤링:**
```python
# server.py 29-53줄
def handle_airport_data(self):
    # 1. 인천공항 사이트 접속
    response = requests.get(base_url, params=params)

    # 2. HTML 파싱
    soup = BeautifulSoup(response.text, 'html.parser')
    data = self.parse_airport_html(soup, date_param)

    # 3. JSON 반환
    self.wfile.write(json.dumps(data).encode('utf-8'))
```

### importer.js의 Fallback

```javascript
// importer.js 166-213줄
static async fetchFromApi(date) {
    try {
        // 1차 시도: Python 서버 (실시간)
        const response = await fetch('/api/airport-data');
        return await response.json();

    } catch (error) {
        // 2차 시도: 정적 파일 (백업)
        const staticResponse = await fetch('src/data/latest_data.json');
        return await staticResponse.json();
    }
}
```

## 🎯 결론 및 권장사항

### 개발/테스트 환경
```bash
✅ python server.py 실행
→ 실시간 데이터, 날짜 선택, 빠른 응답
```

### 프로덕션 배포 (서버 있음)
```bash
✅ python server.py 또는 gunicorn/uwsgi
→ 완벽한 기능, 실시간 데이터
```

### 프로덕션 배포 (서버 없음)
```bash
✅ GitHub Pages + GitHub Actions
→ 자동 업데이트, 무료, 간단
❌ 최대 1시간 지연
```

### 하이브리드 (최고)
```bash
✅ Python 서버 + GitHub Actions (백업)
→ 평소: 실시간
→ 서버 다운 시: 정적 파일로 자동 Fallback
```

## 🔧 현재 상황 확인하기

브라우저 콘솔(F12)에서:

```javascript
// 데이터 소스 확인
window.iqmApp.state.forecast.source

// 가능한 값:
// - "api": Python 서버로부터 실시간 크롤링
// - "static": src/data/latest_data.json 읽음
// - "csv": CSV 파일 업로드
// - "manual": 수동 입력
// - "sample": 샘플 데이터
```

## ⚙️ 설정 변경하기

### 옵션 1: 항상 CORS 프록시 사용 (서버 불필요)

```javascript
// src/js/data/importer.js 수정
import { BrowserDataFetcher } from './browserFetch.js';

static async fetchFromApi(date) {
    // Python 서버 대신 CORS 프록시 사용
    return await BrowserDataFetcher.fetchFromBrowser(date);
}
```

### 옵션 2: 우선순위 체인

```javascript
static async fetchFromApi(date) {
    try {
        // 1순위: Python 서버 (가장 빠름)
        return await this.fetchFromPythonServer(date);
    } catch (e1) {
        try {
            // 2순위: CORS 프록시 (실시간 백업)
            return await BrowserDataFetcher.fetchFromBrowser(date);
        } catch (e2) {
            // 3순위: 정적 파일 (최종 백업)
            return await this.fetchFromStaticFile();
        }
    }
}
```

## 📝 요약 테이블

| 방법 | Python 서버 | GitHub Actions | 실시간 | 날짜 선택 |
|------|-------------|----------------|--------|-----------|
| **현재 (서버 ON)** | ✅ 필요 | ❌ 선택 | ✅ | ✅ |
| **현재 (서버 OFF)** | ❌ 없음 | ✅ 필요 | ❌ | ❌ |
| **CORS 프록시** | ❌ 없음 | ❌ 불필요 | ✅ | ✅ |
| **하이브리드** | ✅ 권장 | ✅ 백업 | ✅ | ✅ |

