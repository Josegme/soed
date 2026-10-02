import type mensajes from '../messages/es.json';
import type { routing } from './i18n/routing';

/**
 * Claves de traducción tipadas (ADR-0005): `tsc` falla si una pantalla usa una
 * clave que no existe. La paridad entre idiomas la verifica `pnpm i18n:check`.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof mensajes;
  }
}
