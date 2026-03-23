const CACHE_NAME = 'xiaodianlv-v4';
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(['/', '/index.html', '/manifest.json']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/') || e.request.url.includes('/download/')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(cache => cache.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(c => c || caches.match('/index.html'))));
});
