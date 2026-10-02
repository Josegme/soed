/**
 * Traductor para claves que llegan como datos (códigos de la base, mensajes de
 * error de acciones). Las claves literales siguen tipadas por next-intl; este
 * helper es el único punto donde se relaja, y siempre se usa con `has()` o con
 * catálogos cuyos códigos están en los mensajes.
 */
export interface TraductorLibre {
  (clave: string, valores?: Record<string, string | number | Date>): string;
  has(clave: string): boolean;
}

export const libre = (t: unknown): TraductorLibre => t as TraductorLibre;

/** Etiqueta de un código de catálogo extensible (p. ej. medios de cobro): si no hay traducción, el código. */
export function etiquetaCodigo(t: unknown, codigo: string): string {
  const tl = libre(t);
  return tl.has(codigo) ? tl(codigo) : codigo;
}
