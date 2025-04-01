const CACHE_NAME = 'object-detection-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon192.png',
  './icons/icon512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.1/dist/ort-wasm-simd-threaded.jsep.wasm',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.1/dist/ort-wasm-simd.wasm',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.4.1/dist/ort-wasm.wasm'
];

// 安装 Service Worker 并缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// 激活 Service Worker 并清理旧缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 拦截网络请求并优先使用缓存
self.addEventListener('fetch', event => {
  // 跳过不支持缓存的请求（如 Chrome 扩展请求）
  if (!event.request.url.startsWith('http')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到响应，则返回缓存的响应
        if (response) {
          return response;
        }
        
        // 否则发起网络请求
        return fetch(event.request)
          .then(networkResponse => {
            // 如果响应无效，直接返回
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // 克隆响应，因为响应是流，只能使用一次
            const responseToCache = networkResponse.clone();
            
            // 将新响应添加到缓存
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return networkResponse;
          });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        // 可以在这里返回一个离线页面
      })
  );
}); 