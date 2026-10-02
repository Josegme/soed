/**
 * Acreditación (F5). Regla innegociable (TR-12, OP-25): la deuda nunca bloquea
 * la acreditación. Estas funciones no reciben datos de cobro a propósito.
 */
export interface Credencial {
  readonly id: string;
  readonly zonas: readonly string[];
  readonly acreditadoAt: string | null;
  readonly anulada: boolean;
}

export type ResultadoAcreditacion =
  | { readonly tipo: 'ACREDITADO'; readonly at: string }
  | { readonly tipo: 'YA_ACREDITADO'; readonly at: string }
  | { readonly tipo: 'CREDENCIAL_ANULADA' };

/** Acreditar es idempotente: un segundo escaneo informa la hora del primero (OP-17, OP-22). */
export function acreditar(credencial: Credencial, ahora: string): ResultadoAcreditacion {
  if (credencial.anulada) return { tipo: 'CREDENCIAL_ANULADA' };
  if (credencial.acreditadoAt) return { tipo: 'YA_ACREDITADO', at: credencial.acreditadoAt };
  return { tipo: 'ACREDITADO', at: ahora };
}

/** Control de acceso por zona (OP-24). Una credencial sin zonas no accede a zonas restringidas. */
export const puedeAcceder = (credencial: Credencial, zona: string): boolean => !credencial.anulada && credencial.zonas.includes(zona);
