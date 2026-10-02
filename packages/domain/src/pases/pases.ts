import type { Ajuste } from '../liquidacion/tipos';
import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';

/**
 * Pase manual de un selectivo a la final (OR-33, TR-13). El sistema registra la
 * decisión del organizador; nunca la toma ni la exige para inscribirse.
 */
export type Beneficio =
  | { readonly tipo: 'DESCUENTO_PORCENTAJE'; readonly porcentaje: number }
  | { readonly tipo: 'DESCUENTO_MONTO'; readonly montoCentavos: number }
  | { readonly tipo: 'BECA' };

export interface PaseNuevo {
  readonly coreografiaId?: string | null;
  readonly academiaId?: string | null;
  readonly eventoDestinoId: string;
  readonly motivo: string;
  readonly beneficio?: Beneficio | null;
}

export type CodigoErrorPase = 'DESTINO_AMBIGUO' | 'MOTIVO_REQUERIDO' | 'BENEFICIO_INVALIDO';

export function validarPase(pase: PaseNuevo): Result<PaseNuevo, ErrorDominio<CodigoErrorPase>> {
  const destinos = [pase.coreografiaId, pase.academiaId].filter((d) => d);
  if (destinos.length !== 1) return err(errorDominio('DESTINO_AMBIGUO'));
  if (pase.motivo.trim().length < 3) return err(errorDominio('MOTIVO_REQUERIDO'));
  const b = pase.beneficio;
  if (b) {
    const valido =
      b.tipo === 'BECA' ||
      (b.tipo === 'DESCUENTO_PORCENTAJE' && b.porcentaje > 0 && b.porcentaje <= 100) ||
      (b.tipo === 'DESCUENTO_MONTO' && Number.isSafeInteger(b.montoCentavos) && b.montoCentavos > 0);
    if (!valido) return err(errorDominio('BENEFICIO_INVALIDO'));
  }
  return ok({ ...pase, motivo: pase.motivo.trim() });
}

/** Traduce el beneficio de un pase a un ajuste de liquidación (OR-34). */
export function ajusteDesdeBeneficio(beneficio: Beneficio, motivo: string): Ajuste {
  switch (beneficio.tipo) {
    case 'BECA':
      return { tipo: 'SIN_CARGO', motivo };
    case 'DESCUENTO_PORCENTAJE':
      return { tipo: 'DESCUENTO_PORCENTAJE', porcentaje: beneficio.porcentaje, motivo };
    case 'DESCUENTO_MONTO':
      return { tipo: 'DESCUENTO_MONTO', monto: beneficio.montoCentavos, motivo };
  }
}
