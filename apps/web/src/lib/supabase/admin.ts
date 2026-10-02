import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@soed/shared-types/database';
import { entornoPublico } from '@/lib/entorno';

/**
 * Cliente con service_role (salta RLS). Solo para columnas derivadas que calcula
 * el dominio (validación de fichas, liquidaciones, resultados) y tareas de
 * servidor, SIEMPRE después de verificar el permiso del usuario con su cliente
 * RLS. Nunca se importa desde código de cliente (server-only).
 */
export function supabaseAdmin() {
  const entorno = entornoPublico();
  const secreta = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!entorno || !secreta) throw new Error('SUPABASE_SECRET_KEY no configurada');
  return createClient<Database>(entorno.supabaseUrl, secreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
