import { routing } from '@/i18n/routing';
import { PREFIJO_URL } from '@/lib/i18n/locales';
import { moduloOn } from '@/lib/modulos';
import { codigoServiceWorker } from '@/lib/pwa/service-worker';

export const dynamic = 'force-static';

/** Service worker generado con los idiomas de la instancia (PU-14). Sin módulo PWA, 404. */
export function GET() {
  if (!moduloOn('pwa')) return new Response(null, { status: 404 });
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'local';
  const paginas = Object.fromEntries(routing.locales.map((l) => [PREFIJO_URL[l], `${PREFIJO_URL[l]}/sin-conexion`]));
  return new Response(codigoServiceWorker(version, paginas), {
    headers: {
      'content-type': 'application/javascript; charset=utf-8',
      'cache-control': 'public, max-age=0, must-revalidate',
      'service-worker-allowed': '/',
    },
  });
}
