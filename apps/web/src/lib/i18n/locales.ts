import { IDIOMAS, type Idioma } from '@soed/domain';

/**
 * Catálogo único de idiomas (ADR-0005). Agregar un idioma: sumarlo a IDIOMAS en
 * @soed/domain, crear messages/<codigo>.json y declarar aquí su prefijo y
 * nombre. Ninguna pantalla cambia.
 */
export const IDIOMAS_SOPORTADOS = IDIOMAS;

export const PREFIJO_URL: Readonly<Record<Idioma, string>> = { es: '/es', 'pt-BR': '/pt' };

export const NOMBRE_IDIOMA: Readonly<Record<Idioma, string>> = { es: 'Español', 'pt-BR': 'Português' };

/** Etiqueta BCP 47 para atributos lang y hreflang. */
export const ETIQUETA_LANG: Readonly<Record<Idioma, string>> = { es: 'es', 'pt-BR': 'pt-BR' };

/** Convierte el segmento [locale] (string en los tipos de Next) en Idioma. */
export function idiomaDe(locale: string): Idioma {
  return (IDIOMAS as readonly string[]).includes(locale) ? (locale as Idioma) : 'es';
}
