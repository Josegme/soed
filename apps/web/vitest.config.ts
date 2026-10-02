import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./src/lib/test/server-only.ts', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['src/**/*.integracion.test.ts', 'node_modules/**'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['src/modules/**/application/**', 'src/lib/**'], exclude: ['**/*.test.ts', 'src/lib/test/**'] },
  },
});
