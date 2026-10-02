import { defineRouting } from 'next-intl/routing';
import { cliente } from '@/cliente';
import { PREFIJO_URL } from '@/lib/i18n/locales';

/** Rutas /es y /pt (ADR-0005). Los idiomas activos los define client.config. */
export const routing = defineRouting({
  locales: cliente.idiomas,
  defaultLocale: cliente.idiomaDefecto,
  localePrefix: { mode: 'always', prefixes: PREFIJO_URL },
  localeCookie: { name: 'SOED_IDIOMA', maxAge: 60 * 60 * 24 * 365 },
});
