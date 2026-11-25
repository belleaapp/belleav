// Service worker BelleaV : application installable + fonctionnement hors-ligne de base
const V = 'belleav-v1';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/ui.js', 'js/views.js', 'js/components.js', 'js/catalog.js', 'js/store.js', 'js/utils.js', 'js/icons.js', 'js/wilayas.js', 'js/config.js', 'js/orders.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const putCache = (req, res) => { const cp = res.clone(); caches.open(V).then((c) => c.put(req, cp)); return res; };

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    // Réseau d'abord (mises à jour immédiates), cache en secours hors-ligne
    e.respondWith(fetch(e.request).then((r) => putCache(e.request, r)).catch(() => caches.match(e.request).then((r) => r || caches.match('index.html'))));
    return;
  }
  // Polices et photos produits : cache d'abord
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(u.host);
  const isImg = e.request.destination === 'image' && /firebasestorage|storage\.googleapis/.test(u.host);
  if (isFont || isImg) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((res) => putCache(e.request, res))));
  }
  // Tout le reste (Firebase, catalogue publié) : réseau direct, jamais mis en cache ici
});
