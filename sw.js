/* SHYNWELL service worker.
   - App files (page, icons, manifest) and the CDN libraries are cached so the app opens fast and shows its screen offline.
   - Google Apps Script and Supabase calls are NEVER cached: orders, inventory, login and OTP always go to the network. */
const VERSION = 'shynwell-v12';   // bump this whenever index.html / icons change so phones drop the old cache
const SHELL = ['./', './index.html', './style.css', './app.js', './intro.js', './logo.webp', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon-32.png', './favicon-48.png'];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (/\.mp4$/i.test(url.pathname)) return;   // intro video: let the browser stream it (Safari needs range requests)
    // page: network first (so updates arrive), cache as the offline fallback
    if (req.mode === 'navigate' && (url.pathname === '/' || /\/index\.html$/.test(url.pathname))) {
      /* instant start from the cache, refreshed in the background (the next open has the newest page) */
      e.respondWith(caches.match('./index.html').then(h => { const net = fetch(req).then(r => { if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put('./index.html', c)); } return r; }); return h || net; }).catch(() => fetch(req)));
      return;
    }
    // icons, manifest: cache first
    e.respondWith(caches.match(req).then(h => h || fetch(req).then(r => { if (r && r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(req, c)); } return r; })));
    return;
  }
  if (CDN.includes(url.hostname)) {     // libraries and fonts: use the cached copy, refresh it in the background
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(h => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => h);
      return h || net;
    })));
  }
  // anything else (script.google.com, supabase, images from other sites) goes straight to the network
});
