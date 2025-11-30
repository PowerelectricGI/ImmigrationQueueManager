# Immigration Queue Manager - 실행 가이드

## 📋 목차
- [시스템 요구사항](#시스템-요구사항)
- [빠른 시작](#빠른-시작)
- [실행 방법](#실행-방법)
- [데이터 가져오기](#데이터-가져오기)
- [문제 해결](#문제-해결)

## 🖥️ 시스템 요구사항

### 필수 요구사항
- **Python 3.9 이상** - 서버 실행 및 데이터 수집용
- **모던 웹 브라우저** - Chrome, Firefox, Edge, Safari (ES6 모듈 지원 필요)
- **인터넷 연결** - 실시간 데이터 가져오기 시 필요

### Python 라이브러리
```bash
pip install requests beautifulsoup4
```

## 🚀 빠른 시작

### 1단계: 저장소 클론 또는 다운로드
```bash
git clone https://github.com/your-username/ImmigrationQueueManager.git
cd ImmigrationQueueManager
```

### 2단계: Python 의존성 설치
```bash
pip install requests beautifulsoup4
```

### 3단계: 서버 실행
```bash
python server.py
```

### 4단계: 브라우저에서 열기
브라우저 주소창에 입력:
```
http://localhost:8080/index.html
```

✅ **완료!** 애플리케이션이 실행됩니다.

## 📖 실행 방법

### 방법 1: 전체 기능 사용 (권장)

**API 데이터 가져오기 기능을 사용하려면 Python 서버 필요**

```bash
# 터미널에서 실행
python server.py
```

서버가 시작되면 다음 메시지를 볼 수 있습니다:
```
Serving at port 8080
Proxy endpoint available at /api/airport-data
```

이제 브라우저에서 접속:
```
http://localhost:8080/index.html
```

**서버 실행 시 가능한 기능:**
- ✅ 실시간 인천공항 데이터 가져오기
- ✅ CSV 파일 업로드
- ✅ 샘플 데이터 사용
- ✅ 모든 기능 정상 작동

### 방법 2: 간단한 실행 (API 없이)

**API 없이 정적 파일만 실행하려면:**

```bash
# 간단한 HTTP 서버 실행
python -m http.server 8080
```

브라우저에서 접속:
```
http://localhost:8080/index.html
```

**정적 서버 실행 시 제한사항:**
- ❌ 실시간 인천공항 데이터 가져오기 불가
- ✅ CSV 파일 업로드 가능
- ✅ 샘플 데이터 사용 가능
- ✅ 수동 입력 가능

### 방법 3: 파일로 직접 열기 (비추천)

브라우저에서 `index.html` 파일을 직접 열 수도 있지만:
```
file:///C:/Users/.../ImmigrationQueueManager/index.html
```

**⚠️ 제한사항:**
- ❌ ES6 모듈이 CORS 오류로 작동하지 않을 수 있음
- ❌ localStorage가 제한될 수 있음
- ❌ 대부분의 기능이 작동하지 않을 수 있음

**→ 반드시 HTTP 서버를 통해 실행하세요!**

## 📊 데이터 가져오기

### 1. 실시간 공항 데이터 가져오기

**전제조건:** `python server.py` 실행 중이어야 함

1. 애플리케이션 우측 상단 **설정 버튼(⚙️)** 클릭
2. **"Data Import"** 섹션으로 스크롤
3. 날짜 선택 (오늘 ~ 내일+2일)
4. **"Fetch Live Data"** 버튼 클릭
5. 데이터 로딩 완료 후 대시보드로 자동 전환

**데이터 소스:** https://www.airport.kr/ap_ko/883/subview.do

### 2. CSV 파일 업로드

1. 설정 버튼(⚙️) 클릭
2. **"Upload CSV File"** 버튼 클릭
3. CSV 파일 선택

**CSV 형식 예시:**
```csv
시간,입국_AB,입국_C,입국_D,입국_EF,출국_12,출국_3,출국_4,출국_56
00~01,100,150,120,80,200,100,90,110
01~02,120,160,130,90,210,110,95,115
...
```

### 3. 샘플 데이터 사용

1. 설정 버튼(⚙️) 클릭
2. **"Use Sample Data"** 버튼 클릭
3. 즉시 샘플 데이터로 대시보드 표시

**용도:** 기능 테스트 및 데모용

### 4. 수동 데이터 입력

1. 설정 버튼(⚙️) 클릭
2. **"Manual Input"** 섹션으로 스크롤
3. 24시간 각 시간대별 입국/출국 승객 수 입력
4. **"Save Data"** 버튼 클릭

## 🔧 주요 기능

### 대시보드 화면

**입국 심사 구역:**
- 시간대별 구역(AB, C, D, EF) 승객 현황
- 필요 심사관 수 자동 계산
- 혼잡도 경보 표시 (🔵 🟡 🟠 🔴)

**출국 심사 구역:**
- 시간대별 구역 승객 현황
- 필요 심사관 수 자동 계산
- 혼잡도 경보 표시

**타임라인 차트:**
- 24시간 승객 추이 시각화
- 입국/출국 추세 비교
- 피크 시간대 확인

### 설정 화면

**서비스 속도 설정:**
- 입국 심사: 내국인/외국인 처리 속도 (명/시간)
- 출국 심사: 내국인/외국인 처리 속도 (명/시간)
- 전자게이트: 처리 속도 (명/시간)

**목표 지표:**
- 목표 대기시간: 15분 (기본값)
- 목표 활용률: 85% (기본값)

**비율 설정:**
- 전자게이트 이용률: 30% (기본값)
- 외국인 비율: 입국 60%, 출국 30% (기본값)

**혼잡도 경보 기준:**
- 🔵 Blue: 7,000명/시간
- 🟡 Yellow: 7,600명/시간
- 🟠 Orange: 8,200명/시간
- 🔴 Red: 8,600명/시간

## 📱 모바일 사용

이 애플리케이션은 **PWA (Progressive Web App)**로 설계되었습니다.

### 모바일 설치 (Android/iOS)

1. 모바일 브라우저에서 접속
2. 브라우저 메뉴 → "홈 화면에 추가"
3. 설치 후 앱처럼 사용 가능

**최적화:**
- 세로 화면(Portrait) 최적화
- 터치 인터페이스 지원
- 오프라인 사용 가능 (일부 기능)

## 🛠️ 문제 해결

### 문제 1: "Module not found" 오류

**증상:**
```
Failed to load module script: Expected a JavaScript module script...
```

**원인:** 파일을 직접 열었거나 HTTP 서버 없이 실행

**해결:**
```bash
# 반드시 HTTP 서버 사용
python server.py
# 또는
python -m http.server 8080
```

### 문제 2: "Cannot GET /api/airport-data" 오류

**증상:** "Fetch Live Data" 클릭 시 오류 메시지

**원인:** `server.py`가 실행되지 않음

**해결:**
```bash
# server.py 실행
python server.py

# 의존성 설치 확인
pip install requests beautifulsoup4
```

### 문제 3: Python 라이브러리 설치 오류

**증상:**
```
ModuleNotFoundError: No module named 'requests'
```

**해결:**
```bash
# pip 업그레이드
python -m pip install --upgrade pip

# 라이브러리 재설치
pip install requests beautifulsoup4

# 가상환경 사용 (권장)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install requests beautifulsoup4
```

### 문제 4: 포트 8080이 이미 사용 중

**증상:**
```
OSError: [Errno 48] Address already in use
```

**해결:**
```bash
# 다른 포트 사용
python server.py  # server.py의 PORT 변수를 8081로 변경
# 또는
python -m http.server 8081

# 브라우저에서 접속
http://localhost:8081/index.html
```

### 문제 5: 데이터가 로드되지 않음

**해결 순서:**
1. 브라우저 콘솔 확인 (F12)
2. 서버 로그 확인
3. 인터넷 연결 확인
4. 샘플 데이터로 테스트
5. 브라우저 캐시 삭제 후 재시도

### 문제 6: 차트가 표시되지 않음

**원인:** 데이터가 없거나 형식이 잘못됨

**해결:**
1. 샘플 데이터로 테스트
2. 콘솔에서 에러 확인
3. localStorage 초기화:
```javascript
// 브라우저 콘솔에서 실행
localStorage.clear()
location.reload()
```

## 📂 프로젝트 구조

```
ImmigrationQueueManager/
├── index.html              # 메인 HTML 파일
├── server.py               # Python 프록시 서버
├── CLAUDE.md               # 개발자 문서
├── GETTING_STARTED.md      # 이 파일
├── .gitignore              # Git 제외 파일 목록
│
├── src/
│   ├── manifest.json       # PWA 매니페스트
│   ├── sw.js              # 서비스 워커 (PWA)
│   │
│   ├── css/               # 스타일시트
│   │   ├── variables.css
│   │   ├── main.css
│   │   └── responsive.css
│   │
│   ├── js/                # JavaScript 모듈
│   │   ├── app.js         # 메인 애플리케이션
│   │   ├── config.js      # 설정 및 상수
│   │   │
│   │   ├── core/          # 핵심 로직
│   │   │   ├── calculator.js    # 심사관 수 계산
│   │   │   ├── queueModel.js    # M/M/c 대기행렬 모델
│   │   │   └── alertSystem.js   # 혼잡도 경보
│   │   │
│   │   ├── data/          # 데이터 관리
│   │   │   ├── importer.js      # 데이터 가져오기
│   │   │   ├── sampleData.js    # 샘플 데이터
│   │   │   └── storage.js       # localStorage 관리
│   │   │
│   │   ├── ui/            # UI 컴포넌트
│   │   │   ├── dashboard.js     # 대시보드 화면
│   │   │   ├── staff.js         # 인력 관리
│   │   │   ├── chart.js         # 차트 렌더링
│   │   │   ├── components.js    # 재사용 컴포넌트
│   │   │   └── settings.js      # 설정 패널
│   │   │
│   │   └── utils/         # 유틸리티
│   │       └── helpers.js
│   │
│   └── data/              # 데이터 파일
│       └── latest_data.json     # 최신 공항 데이터
│
├── scripts/               # 데이터 수집 스크립트
│   ├── update_data.py     # 데이터 업데이트
│   └── fetch_data.py      # 데이터 가져오기
│
└── docs/                  # 문서
    ├── PRD.md             # 제품 요구사항 문서
    └── LLD.md             # 상세 설계 문서
```

## 🔄 데이터 자동 업데이트 (GitHub Actions)

이 프로젝트는 **GitHub Actions**를 사용하여 매시간 자동으로 공항 데이터를 업데이트합니다.

**워크플로우:** `.github/workflows/daily_update.yml`

**실행 주기:** 매시간 정각

**작동 방식:**
1. 인천공항 웹사이트에서 데이터 수집
2. `src/data/latest_data.json` 업데이트
3. 변경사항 자동 커밋 및 푸시

**수동 실행:**
GitHub 저장소 → Actions → "Daily Data Update" → "Run workflow"

## 💡 개발 팁

### 개발자 모드 실행

```bash
# 서버 실행
python server.py

# 브라우저 개발자 도구 열기 (F12)
# 콘솔에서 앱 상태 확인
window.iqmApp.state
```

### 데이터 구조 확인

```javascript
// 브라우저 콘솔에서
console.log(window.iqmApp.state.forecast)    // 승객 예측 데이터
console.log(window.iqmApp.state.requirement) // 계산된 필요 인원
console.log(window.iqmApp.state.settings)    // 현재 설정
```

### 설정 초기화

```javascript
// 브라우저 콘솔에서
localStorage.clear()
location.reload()
```

## 📞 지원 및 기여

**문제 보고:** GitHub Issues
**기여 방법:** Pull Request 환영
**문의:** 프로젝트 저장소의 Issues 탭 활용

---

**버전:** 1.0.0
**최종 업데이트:** 2024-11-30
**라이선스:** MIT (필요시 수정)
