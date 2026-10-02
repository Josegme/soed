import 'server-only';
import { getLocale } from 'next-intl/server';
import { cache } from 'react';
import { redirect } from '@/i18n/navigation';
import { supabaseServidor, type ClienteSupabase } from '@/lib/supabase/server';
import { construirSesion, tienePermiso, type Sesion } from './permisos';

export * from './permisos';

/** Sesión del request (cookies de Supabase), cacheada por request. */
export const obtenerSesion = cache(async (): Promise<{ sesion: Sesion; db: ClienteSupabase } | null> => {
  const db = await supabaseServidor();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  if (!data.user) return null;
  return { db, sesion: await construirSesion(db, data.user) };
});

/** Exige sesión; si no hay, redirige a ingresar en el idioma actual. */
export async function requerirSesion(): Promise<{ sesion: Sesion; db: ClienteSupabase }> {
  const actual = await obtenerSesion();
  if (!actual) {
    const locale = await getLocale();
    redirect({ href: '/ingresar', locale });
    throw new Error('inalcanzable');
  }
  return actual;
}

export async function requerirPermiso(eventoId: string, permiso: string) {
  const actual = await requerirSesion();
  if (!tienePermiso(actual.sesion, eventoId, permiso)) {
    const locale = await getLocale();
    redirect({ href: '/panel', locale });
  }
  return actual;
}
