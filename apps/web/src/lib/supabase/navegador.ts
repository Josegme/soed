'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@soed/shared-types/database';

let instancia: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Cliente del navegador (Realtime, Storage, uploads). Usa la clave publicable; RLS protege los datos. */
export function supabaseNavegador(url: string, clave: string) {
  instancia ??= createBrowserClient<Database>(url, clave);
  return instancia;
}
