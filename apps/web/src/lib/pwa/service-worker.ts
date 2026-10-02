/**
 * Código del service worker (PU-14, ADR-0010). Política deliberadamente
 * mínima para no exponer datos de sesión:
 * - Navegación: siempre red; sin conexión, la página «sin conexión» del idioma.
 * - /_next/static: caché primero (archivos públicos con hash, inmutables).
 * - Nada más se cachea: ni HTML del panel, ni API, ni datos de Supabase.
 * Lo que el usuario carga sin conexión vive en la cola IndexedDB (outbox).
 */
export function codigoServiceWorker(version: string, paginasSinConexion: Record<string, string>): string {
  const cache = `soed-shell-${version}`;
  return `
const CACHE = ${JSON.stringify(cache)};
const SIN_CONEXION = ${JSON.stringify(paginasSinConexion)};
const PAGINAS = Object.values(SIN_CONEXION);

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PAGINAS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith('soed-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function paginaPara(url) {
  const ruta = new URL(url).pathname;
  const prefijo = Object.keys(SIN_CONEXION).find((p) => ruta === p || ruta.startsWith(p + '/'));
  return SIN_CONEXION[prefijo ?? Object.keys(SIN_CONEXION)[0]];
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(async () => (await caches.match(paginaPara(request.url))) ?? Response.error()));
    return;
  }
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(
        (guardada) =>
          guardada ??
          fetch(request).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              caches.open(CACHE).then((c) => c.put(request, copia));
            }
            return r;
          }),
      ),
    );
  }
});
`;
}
