/**
 * Contenido del organizador en varios idiomas (ADR-0005). Agregar un idioma =
 * sumar el código a IDIOMAS; ninguna regla de dominio cambia.
 */
export const IDIOMAS = ['es', 'pt-BR'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export type Traducible = Partial<Record<Idioma, string>>;

export function esIdioma(valor: string): valor is Idioma {
  return (IDIOMAS as readonly string[]).includes(valor);
}

export interface TextoResuelto {
  readonly texto: string;
  /** true si se usó otro idioma porque faltaba la traducción pedida. */
  readonly faltante: boolean;
}

/**
 * Devuelve el texto en el idioma pedido; si falta, usa el idioma por defecto del
 * evento y luego cualquier idioma disponible.
 */
export function traducir(valor: Traducible, idioma: Idioma, idiomaDefecto: Idioma): TextoResuelto {
  const pedido = valor[idioma]?.trim();
  if (pedido) return { texto: pedido, faltante: false };
  const defecto = valor[idiomaDefecto]?.trim();
  if (defecto) return { texto: defecto, faltante: true };
  for (const codigo of IDIOMAS) {
    const otro = valor[codigo]?.trim();
    if (otro) return { texto: otro, faltante: true };
  }
  return { texto: '', faltante: true };
}

/** Idiomas sin traducción para mostrar "pendiente" en el panel. */
export function idiomasPendientes(valor: Traducible, idiomas: readonly Idioma[] = IDIOMAS): Idioma[] {
  return idiomas.filter((i) => !valor[i]?.trim());
}
