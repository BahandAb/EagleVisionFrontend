const CACHE_NAME = 'eaglevision-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/session.html',
  '/workspace.html',
  '/host.html',
  '/style.css',
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
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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

  if (url.hostname === 'api.eaglevision.dev' ||
      url.hostname.includes('livekit') ||
      url.hostname.includes('cdn.jsdelivr.net') ||
      url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
