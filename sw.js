const CACHE_NAME = 'eaglevision-v14';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/session.html',
  '/workspace.html',
  '/host.html',
  '/tokens.css',
  '/style.css',
  '/themes.css',
  '/host.css',
  '/fonts.css',
  '/sw-register.js',
  '/assets/fonts/fredoka-latin-700-normal.woff2',
  '/assets/fonts/poppins-latin-400-normal.woff2',
  '/landing.css',
  '/script.js',
  '/host.js',
  '/img_processor.js',
  '/js/socket.io.min.js',
  '/assets/EagleVisionLogo.png',
  '/assets/EagleAILogo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // cache:'reload' skips the browser HTTP cache so we never precache a stale copy
      Promise.all(STATIC_ASSETS.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle same-origin GETs. Everything else (API calls, LiveKit,
  // CDN scripts, Google Fonts, the multi-MB opencv.js) goes straight to the
  // network untouched, and POSTs can't be cached anyway.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first: always serve what's actually deployed when online, and
  // only fall back to the cache when the network fails. The previous
  // cache-first strategy meant every future fix would need another manual
  // CACHE_NAME bump to ever reach a device that had already visited the
  // site — this keeps the cache as an offline fallback instead of a
  // permanent trap.
  event.respondWith(
    // cache:'no-cache' = always revalidate with the server (cheap 304 via ETag) instead of
    // trusting the HTTP cache. GitHub Pages sends max-age=600, so a plain fetch() here would
    // happily serve 10-minute-old CSS/JS and break pages whose HTML had already updated.
    fetch(event.request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
