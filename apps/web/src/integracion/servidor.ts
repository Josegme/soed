import type { Server } from 'node:http';
import { iniciarSupabaseFalso } from '../../../../scripts/lib/supabase-falso.mjs';

/**
 * globalSetup de Vitest: doble de la API de Supabase (/rest/v1 → PostgREST,
 * /auth/v1/user desde el JWT) para que supabase-js y los adaptadores corran
 * sin cambios contra el esquema real. El mismo doble sirve al e2e del panel.
 */
let servidor: Server | undefined;

export async function setup() {
  servidor = await iniciarSupabaseFalso({
    puerto: 54331,
    destino: process.env.PGRST_URL ?? 'http://127.0.0.1:54330',
    secreto: process.env.JWT_SECRET ?? '',
  });
}

export async function teardown() {
  await new Promise<void>((ok) => (servidor ? servidor.close(() => ok()) : ok()));
}
