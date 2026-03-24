const CACHE_NAME = 'xiaodianlv-v6';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // HTML 不缓存，始终从网络获取最新
  const url = e.request.url;
  if (url.includes('/api/') || url.includes('/download/') || url.endsWith('/') || url.includes('/index.html')) {
    e.respondWith(fetch(url).catch(() => caches.match('/index.html')));
    return;
  }
  // 静态资源：缓存优先
  e.respondWith(
    caches.match(url).then(cached => {
      if (cached) return cached;
      return fetch(url).then(r => {
        if (r.status === 200) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(url, clone));
        }
        return r;
      }).catch(() => null);
    })
  );
});
