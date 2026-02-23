const CACHE_NAME = 'maestro-pro-v2-local';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/professor.js',
    './js/pwa.js',
    './icons/icon-192.png',
    './icons/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Cache aberto', CACHE_NAME);
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Limpando cache antigo:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Estratégia Cache-First (Offline Absoluto)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Se encontrou no cache, retorna imediatamente (Rápido e Offline)
            if (cachedResponse) {
                return cachedResponse;
            }

            // Se não encontrou, busca na rede
            return fetch(event.request).then((networkResponse) => {
                // Verifica se recebemos uma resposta válida
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    if (event.request.url.includes('tailwind') || event.request.url.includes('font-awesome')) {
                        // Respostas opacas de CDNs
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse.clone()));
                    }
                    return networkResponse;
                }

                // Clona a resposta e guarda no cache para o futuro
                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            }).catch(() => {
                // Falha de rede catastrófica (offline sem cache)
                console.warn('(Offline Offline fallback) Fetch failed for: ', event.request.url);
            });
        })
    );
});
