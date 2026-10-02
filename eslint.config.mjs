import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

/**
 * Reglas que hacen cumplir CLAUDE.md:
 * - El dominio no importa nada externo (Clean Architecture).
 * - Ningún texto visible en literal en JSX (ADR-0005).
 * - service_role solo en infraestructura de servidor (seguridad).
 */
export default defineConfig([
  globalIgnores([
    '**/.next/**',
    '**/node_modules/**',
    '**/coverage/**',
    '**/dist/**',
    '**/next-env.d.ts',
    '.claude/**',
    'docs/**',
    'packages/shared-types/src/database.types.ts',
    'apps/web/src/cliente/generado/**',
    'apps/web/public/**',
    'apps/web/playwright-report/**',
    'apps/web/test-results/**',
  ]),
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: 'apps/web/' }, react: { version: '19.3' } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'import/no-anonymous-default-export': 'off',
    },
  },
  {
    files: ['packages/domain/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ regex: '^(?!\\.)', message: 'El dominio no importa dependencias externas (CLAUDE.md).' }] },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx', 'packages/ui/src/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          noAttributeStrings: false,
          allowedStrings: [
            '·',
            '—',
            '–',
            '*',
            ':',
            '/',
            '%',
            '(',
            ')',
            '+',
            '×',
            '#',
            '-',
            '•',
            '|',
            '→',
            '←',
            '…',
            ',',
            '.',
            'N.º',
            '&nbsp;',
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/modules/**/infrastructure/**', 'apps/web/src/lib/supabase/admin.ts', 'apps/web/src/app/api/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: [{ name: '@/lib/supabase/admin', message: 'service_role solo en infraestructura de servidor.' }] },
      ],
    },
  },
]);
