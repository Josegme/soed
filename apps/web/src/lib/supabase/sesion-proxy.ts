import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import { entornoPublico } from '@/lib/entorno';

/** Refresca la sesión de Supabase en cada request (cookies) sin alterar la respuesta de next-intl. */
export async function refrescarSesion(request: NextRequest, response: NextResponse): Promise<NextResponse> {
  const entorno = entornoPublico();
  if (!entorno) return response;
  const supabase = createServerClient(entorno.supabaseUrl, entorno.supabaseClave, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value, options } of lista) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });
  await supabase.auth.getClaims();
  return response;
}
