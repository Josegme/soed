import 'server-only';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@soed/shared-types/database';
import { cookies } from 'next/headers';
import { entornoPublico } from '@/lib/entorno';

export type ClienteSupabase = ReturnType<typeof createServerClient<Database>>;

/**
 * Cliente con la sesión del usuario: toda consulta pasa por RLS. null si la
 * instancia aún no tiene Supabase configurado.
 */
export async function supabaseServidor(): Promise<ClienteSupabase | null> {
  const entorno = entornoPublico();
  if (!entorno) return null;
  const almacen = await cookies();
  return createServerClient<Database>(entorno.supabaseUrl, entorno.supabaseClave, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) almacen.set(name, value, options);
        } catch {
          // Llamado desde un Server Component: el refresh lo hace proxy.ts.
        }
      },
    },
  });
}
