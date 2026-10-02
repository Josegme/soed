import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { firmarJwt } from './src/integracion/jwt';

const secreto = process.env.JWT_SECRET ?? 'sin-secreto';

/** Pruebas de integración contra PostgREST real (scripts/integracion.sh). */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/lib/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.integracion.test.ts'],
    environment: 'node',
    globalSetup: ['./src/integracion/servidor.ts'],
    fileParallelism: false,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54331',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: firmarJwt({ role: 'anon' }, secreto),
      SUPABASE_SECRET_KEY: firmarJwt({ role: 'service_role' }, secreto),
    },
  },
});
