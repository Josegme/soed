import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@soed/shared-types/database';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { firmarJwt } from './jwt';

export const URL_API = 'http://127.0.0.1:54331';
const SECRETO = process.env.JWT_SECRET ?? '';
export const CLAVE_ANON = firmarJwt({ role: 'anon' }, SECRETO);

/** Ids del fixture (tests.ids) leídos una vez con psql. */
export const ids: Record<string, string> = JSON.parse(
  execFileSync('psql', ['-X', '-A', '-t', '-c', 'select json_object_agg(clave, id) from tests.ids'], { encoding: 'utf8' }).trim(),
);

export function sql(consulta: string): string {
  return execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', consulta], { encoding: 'utf8' }).trim();
}

/** Cliente con la sesión de un usuario del fixture (rol authenticated, RLS activa). */
export function clienteDe(clave: string): ClienteSupabase {
  const token = firmarJwt({ sub: ids[clave], role: 'authenticated', email: `${clave}@test.soed` }, SECRETO);
  return createClient<Database>(URL_API, CLAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  }) as unknown as ClienteSupabase;
}

export function clienteAnonimo() {
  return createClient<Database>(URL_API, CLAVE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}
