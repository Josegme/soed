import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@soed/shared-types/database';
import { entornoPublico } from '@/lib/entorno';

/**
 * Cliente anónimo sin cookies para páginas públicas cacheables (rol anon:
 * solo columnas públicas y RPC acotadas, ADR-0008).
 */
export function supabasePublico() {
  const entorno = entornoPublico();
  if (!entorno) return null;
  return createClient<Database>(entorno.supabaseUrl, entorno.supabaseClave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
