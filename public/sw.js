/* VX Engineering: permite instalar la app y abrirla sin internet.
   - Páginas: primero la red (siempre la versión nueva); sin red, la última guardada.
   - Archivos /assets/ (tienen huella en el nombre): se guardan una vez.
   - Firebase y Google nunca pasan por aquí (otro dominio). */
const CACHE = 'vx-app-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(CACHE).then((c) => c.put('./', copia));
          return r;
        })
        .catch(() => caches.match('./').then((r) => r || Response.error()))
    );
    return;
  }

  if (url.pathname.includes('/assets/') || /\.(png|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (r) =>
          r ||
          fetch(req).then((resp) => {
            if (resp.ok) {
              const copia = resp.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return resp;
          })
      )
    );
  }
});
