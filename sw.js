// Rytm: praca offline. Najpierw sieć (żeby zawsze była najnowsza wersja), a bez internetu kopia z pamięci.
// Zapytania do bazy (Supabase) nigdy nie trafiają do pamięci podręcznej.
const CACHE = 'rytm-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './fonts/jersey10-latin.woff2', './fonts/jersey10-latin-ext.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('supabase.co')) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok || res.type === 'opaque') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then(m => m || (req.mode === 'navigate' ? caches.match('./index.html') : undefined)))
  );
});

// Przypomnienia: pokazanie powiadomienia i otwarcie aplikacji po kliknięciu.
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data.json(); } catch (x) { d = { title: 'Rytm', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Rytm', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { url: d.url || './' }
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ('focus' in c) { if ('navigate' in c) c.navigate(url).catch(() => {}); return c.focus(); }
    }
    return clients.openWindow(url);
  }));
});
