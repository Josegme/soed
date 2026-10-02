import createMiddleware from 'next-intl/middleware';
import type { NextRequest } from 'next/server';
import { routing } from '@/i18n/routing';
import { refrescarSesion } from '@/lib/supabase/sesion-proxy';

const intl = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  return refrescarSesion(request, intl(request));
}

export const config = {
  // Todo menos API, assets de Next, archivos estáticos y el callback de auth.
  matcher: ['/((?!api|auth|_next|_vercel|cliente|.*\\..*).*)'],
};
