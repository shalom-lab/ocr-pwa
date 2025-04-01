const CACHE_NAME = 'object-detection-cache-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon192.png',
  './icons/icon512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers'
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
  
  // 对于模型文件，使用更可靠的策略
  if (event.request.url.includes('cdn-lfs.hf.co') || 
      event.request.url.includes('huggingface.co') || 
      event.request.url.includes('.onnx')) {
    
    event.respondWith(
      // 首先尝试从缓存获取
      caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          // 如果缓存中有响应，返回缓存的响应
          return cachedResponse;
        }
        
        // 否则尝试从网络获取
        return fetch(event.request.clone(), {
          // 添加更长的超时时间
          signal: AbortSignal.timeout ? AbortSignal.timeout(120000) : undefined,
          // 确保获取完整响应
          cache: 'no-store'
        })
        .then(networkResponse => {
          // 如果响应无效，直接返回
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          
          // 克隆响应，因为响应是流，只能使用一次
          const responseToCache = networkResponse.clone();
          
          // 将新响应添加到缓存
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.error('Cache put error:', err));
            
          return networkResponse;
        })
        .catch(error => {
          console.error('Fetch error for model file:', error);
          // 如果网络请求失败，返回一个友好的错误响应
          return new Response(
            JSON.stringify({ error: 'Failed to fetch model file. Please try again later.' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        });
      })
    );
    return;
  }
  
  // 对于其他资源，使用缓存优先策略
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
        return new Response(
          '<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
          { 
            status: 503, 
            headers: { 'Content-Type': 'text/html' } 
          }
        );
      })
  );
}); 