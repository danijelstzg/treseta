// Trešeta PWA Service Worker
// Strategija: cache-first za app shell, network-first za font (s fallbackom)

const CACHE_NAME = 'treseta-v7';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './icon-180.png'
];

// Install — predcache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll će failati ako ijedan resurs ne uspije — koristim individualne add() s catch
      return Promise.all(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => console.warn('SW cache miss:', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate — pobriši stare cacheve
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first za navigation i app shell, network-first za font (CDN)
self.addEventListener('fetch', event => {
  const req = event.request;

  // Samo GET zahtjeve cachiramo
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Font (Google Fonts) — network-first, fallback na cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      fetch(req).then(resp => {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(resp => {
          // Cachiraj uspješne odgovore
          if (resp && resp.status === 200 && resp.type === 'basic') {
            const respClone = resp.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, respClone));
          }
          return resp;
        }).catch(() => {
          // Ako navigacija failuje (offline), vrati glavnu HTML stranicu
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});
