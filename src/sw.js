/**
 * src/sw.js
 * Service Worker for Offline Support
 */

const CACHE_NAME = 'iqm-cache-v48';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/main.css',
    './css/variables.css',
    './css/responsive.css',
    './js/app.js',
    './js/config.js',
    './js/data/storage.js',
    './js/data/importer.js',
    './js/data/sampleData.js',
    './js/core/calculator.js',
    './js/core/queueModel.js',
    './js/core/alertSystem.js',
    './js/ui/dashboard.js',
    './js/ui/chart.js',
    './js/ui/components.js',
    './js/ui/settings.js',
    './js/utils/helpers.js',
    './manifest.json',
    'https://cdn.jsdelivr.net/npm/chart.js' // 외부 CDN 캐싱
];

// 설치
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Caching app shell');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// 활성화
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// 요청 가로채기 (Cache First 전략)
self.addEventListener('fetch', (event) => {
    // API 요청 등은 제외하고 정적 자산 위주로 캐싱
    // 여기서는 모든 요청에 대해 캐시 우선 시도
    event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        // 유효한 응답만 캐싱 (CDN 등 외부 리소스 포함)
        if (response && response.status === 200 && response.type === 'basic') {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        console.log('[Service Worker] Network request failed', error);
        // 오프라인 폴백 페이지가 있다면 여기서 반환
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
    }
}
