# Python 서버 없이 데이터 가져오기 - 대안 방법

Python 서버(`server.py`) 없이도 공항 데이터를 가져올 수 있는 여러 방법을 소개합니다.

## 📊 방법 비교표

| 방법 | 난이도 | 실시간 | 안정성 | 추천도 |
|------|--------|--------|--------|--------|
| 1. 정적 JSON 파일 | ⭐ 쉬움 | ❌ | ⭐⭐⭐⭐⭐ | 🥇 **강력 추천** |
| 2. CORS 프록시 | ⭐⭐ 보통 | ✅ | ⭐⭐⭐ | 🥈 추천 |
| 3. 브라우저 확장 | ⭐⭐⭐ 어려움 | ✅ | ⭐⭐ | - |
| 4. GitHub Actions | ⭐ 쉬움 | ⏰ 1시간마다 | ⭐⭐⭐⭐⭐ | 🥇 **강력 추천** |

---

## 방법 1: 정적 JSON 파일 (이미 구현됨!) 🎯

### 작동 원리
- GitHub Actions가 매시간 `src/data/latest_data.json` 자동 업데이트
- 브라우저가 이 파일을 직접 읽음
- **추가 코드 불필요** - 이미 `importer.js`에 구현되어 있음!

### 사용 방법

**1단계: 정적 서버 실행**
```bash
# Python 간단 서버
python -m http.server 8080

# 또는 Node.js (설치된 경우)
npx http-server -p 8080
```

**2단계: 브라우저에서 열기**
```
http://localhost:8080/index.html
```

**3단계: 데이터 가져오기**
- 설정(⚙️) → "Fetch Live Data" 클릭
- 자동으로 `src/data/latest_data.json` 사용됨

### 코드 확인
```javascript
// src/js/data/importer.js 189-211줄
static async fetchFromApi(date) {
    try {
        // API 시도
        const response = await fetch('/api/airport-data');
        // ...
    } catch (error) {
        // ✅ 자동 Fallback
        const staticResponse = await fetch('src/data/latest_data.json');
        const staticData = await staticResponse.json();
        return { ...staticData, source: 'static' };
    }
}
```

### 장점
- ✅ **추가 설치 불필요**
- ✅ **매우 안정적**
- ✅ **GitHub Pages 호환**
- ✅ **이미 구현되어 있음**

### 단점
- ❌ 실시간 아님 (마지막 업데이트: GitHub Actions 실행 시점)
- ❌ 특정 날짜 선택 불가 (항상 최신 데이터만)

---

## 방법 2: CORS 프록시 사용 (새로 구현) 🌐

### 개념
CORS(Cross-Origin Resource Sharing) 정책 때문에 브라우저에서 직접 다른 사이트 데이터를 가져올 수 없습니다. CORS 프록시가 중간에서 요청을 대신 보내줍니다.

```
브라우저 → CORS 프록시 → 인천공항 사이트 → CORS 프록시 → 브라우저
```

### 구현된 코드
`src/js/data/browserFetch.js` 파일이 생성되었습니다.

### 사용 방법

**옵션 A: AllOrigins (추천)**

1. **`importer.js` 수정**
```javascript
// src/js/data/importer.js 상단에 추가
import { BrowserDataFetcher } from './browserFetch.js';

// fetchFromApi 함수 수정
static async fetchFromApi(date) {
    // CORS 프록시 사용
    return await BrowserDataFetcher.fetchFromBrowser(date);
}
```

2. **실행**
```bash
python -m http.server 8080
```

3. **"Fetch Live Data" 클릭** → 실시간 데이터 가져옴!

**옵션 B: CORS Anywhere (추가 설정 필요)**

1. **활성화 페이지 방문**
   - https://cors-anywhere.herokuapp.com/corsdemo
   - "Request temporary access" 클릭

2. **browserFetch.js 수정**
```javascript
static CORS_PROXIES = [
    {
        name: 'AllOrigins',
        url: 'https://api.allorigins.win/raw?url=',
        enabled: false  // AllOrigins 비활성화
    },
    {
        name: 'CORS Anywhere',
        url: 'https://cors-anywhere.herokuapp.com/',
        enabled: true  // CORS Anywhere 활성화
    }
];
```

### 장점
- ✅ **실시간 데이터**
- ✅ **날짜 선택 가능**
- ✅ **Python 서버 불필요**

### 단점
- ❌ 외부 프록시 서비스 의존
- ❌ 속도 제한 가능
- ❌ 프록시 서비스 중단 위험

### 프록시 서비스 비교

**AllOrigins**
- URL: `https://api.allorigins.win/raw?url=`
- 안정성: ⭐⭐⭐⭐
- 속도: 보통
- 제한: 적당함

**CORS Anywhere**
- URL: `https://cors-anywhere.herokuapp.com/`
- 안정성: ⭐⭐⭐
- 속도: 빠름
- 제한: 사용 전 활성화 필요 (12시간마다)

---

## 방법 3: 자체 CORS 프록시 호스팅 (고급) 🚀

무료 호스팅 플랫폼에서 자체 프록시 운영

### Cloudflare Workers

**1. worker.js 생성**
```javascript
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const newResponse = new Response(response.body, response);

    // CORS 헤더 추가
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    return newResponse;
  }
};
```

**2. Cloudflare Workers 배포**
```bash
npm install -g wrangler
wrangler login
wrangler init my-cors-proxy
# worker.js 코드 붙여넣기
wrangler deploy
```

**3. 앱에서 사용**
```javascript
// browserFetch.js에 추가
static CORS_PROXIES = [
    {
        name: 'My Cloudflare Worker',
        url: 'https://my-cors-proxy.yourname.workers.dev/?url=',
        enabled: true
    }
];
```

### 장점
- ✅ 완전한 제어
- ✅ 무료 (일정 한도 내)
- ✅ 빠른 속도

### 단점
- ❌ 설정 복잡
- ❌ 유지보수 필요

---

## 방법 4: GitHub Actions로 자동 업데이트 (현재 사용 중) ⏰

### 작동 방식
```yaml
# .github/workflows/daily_update.yml
on:
  schedule:
    - cron: '0 * * * *'  # 매시간 정각
```

1. GitHub Actions가 매시간 자동 실행
2. `scripts/update_data.py` 실행
3. `src/data/latest_data.json` 업데이트
4. 자동 커밋 & 푸시

### 현재 상태 확인
```bash
# 마지막 업데이트 확인
cat src/data/latest_data.json | grep lastUpdated
```

### 수동 실행
1. GitHub 저장소 방문
2. **Actions** 탭 클릭
3. **Daily Data Update** 선택
4. **Run workflow** 클릭

### 장점
- ✅ **완전 자동화**
- ✅ **매우 안정적**
- ✅ **무료**
- ✅ **이미 구현됨**

### 단점
- ❌ 최대 1시간 지연
- ❌ 특정 날짜 선택 불가

---

## 방법 5: 브라우저 확장 프로그램 (비추천) 🔌

### CORS Unblock 확장 프로그램 설치

**Chrome/Edge:**
1. [CORS Unblock](https://chrome.google.com/webstore/detail/cors-unblock/) 설치
2. 확장 프로그램 활성화
3. 앱 실행

**Firefox:**
1. [CORS Everywhere](https://addons.mozilla.org/en-US/firefox/addon/cors-everywhere/) 설치
2. 확장 프로그램 활성화
3. 앱 실행

### 앱에서 직접 요청
```javascript
// 확장 프로그램 활성화 시 작동
const response = await fetch('https://www.airport.kr/ap_ko/883/subview.do');
const html = await response.text();
// 파싱...
```

### 단점
- ❌ **보안 위험** (모든 사이트에 CORS 우회)
- ❌ 각 사용자가 설치 필요
- ❌ 모바일 미지원

---

## 🎯 권장 솔루션

### 개인 사용/개발
**→ 방법 1 (정적 JSON) + 방법 4 (GitHub Actions)**
- 이미 구현되어 있음
- 추가 작업 불필요
- 매우 안정적

### 실시간 데이터 필요 시
**→ 방법 2 (CORS 프록시 - AllOrigins)**
- 적당한 구현 난이도
- 즉시 사용 가능
- 날짜 선택 가능

### 프로덕션 배포
**→ 방법 3 (자체 프록시) 또는 Python 서버**
- 완전한 제어
- 안정성 최고
- 성능 최적화 가능

---

## 📝 구현 예제 코드

### 예제 1: 정적 JSON 직접 사용

```javascript
// 간단한 데이터 로드
async function loadStaticData() {
    const response = await fetch('src/data/latest_data.json');
    const data = await response.json();
    console.log('Last updated:', data.lastUpdated);
    return data;
}
```

### 예제 2: CORS 프록시 사용

```javascript
import { BrowserDataFetcher } from './src/js/data/browserFetch.js';

// AllOrigins 사용 (기본값)
const data = await BrowserDataFetcher.fetchFromBrowser();

// 특정 날짜 (예: 2024년 1월 15일)
const dateData = await BrowserDataFetcher.fetchFromBrowser('20240115');

// 프록시 변경
BrowserDataFetcher.setProxyEnabled('AllOrigins', false);
BrowserDataFetcher.setProxyEnabled('CORS Anywhere', true);
```

### 예제 3: 여러 소스 시도 (Fallback Chain)

```javascript
async function fetchWithFallback(date) {
    try {
        // 1순위: CORS 프록시로 실시간 데이터
        return await BrowserDataFetcher.fetchFromBrowser(date);
    } catch (e1) {
        console.warn('CORS proxy failed, trying static...', e1);
        try {
            // 2순위: 정적 JSON 파일
            const response = await fetch('src/data/latest_data.json');
            return await response.json();
        } catch (e2) {
            console.warn('Static data failed, using sample...', e2);
            // 3순위: 샘플 데이터
            return SampleForecast;
        }
    }
}
```

---

## ⚠️ 주의사항

### CORS 프록시 사용 시
1. **개인정보 주의**: 프록시가 모든 요청을 볼 수 있음
2. **속도 제한**: 과도한 요청 시 차단 가능
3. **서비스 중단**: 무료 프록시는 언제든 중단 가능

### 브라우저 확장 프로그램
1. **보안 위험**: 모든 사이트에서 CORS 비활성화됨
2. **프로덕션 금지**: 개발/테스트 용도로만 사용
3. **사용 후 비활성화**: 사용하지 않을 때는 꺼두기

### 정적 JSON
1. **캐싱**: 브라우저 캐시로 인해 업데이트 안 보일 수 있음
2. **해결**: Ctrl+F5 (강제 새로고침) 또는 개발자 도구에서 캐시 비활성화

---

## 🔧 문제 해결

### Q: CORS 프록시가 작동하지 않아요
**A:**
1. 브라우저 콘솔(F12) 확인
2. 다른 프록시로 변경 시도
3. 정적 JSON으로 Fallback 확인

### Q: 데이터가 오래된 것 같아요
**A:**
```javascript
// 브라우저 콘솔에서 마지막 업데이트 확인
fetch('src/data/latest_data.json')
    .then(r => r.json())
    .then(d => console.log('Last updated:', d.lastUpdated));
```

### Q: GitHub Pages에서 사용하고 싶어요
**A:**
1. 방법 1 (정적 JSON) 사용 - GitHub Pages 완벽 호환
2. GitHub Actions 자동 업데이트 활성화
3. 배포 후 바로 사용 가능!

---

## 📚 추가 자료

- [CORS 이해하기](https://developer.mozilla.org/ko/docs/Web/HTTP/CORS)
- [AllOrigins 문서](https://allorigins.win/)
- [Cloudflare Workers 가이드](https://developers.cloudflare.com/workers/)
- [GitHub Actions 문서](https://docs.github.com/en/actions)

