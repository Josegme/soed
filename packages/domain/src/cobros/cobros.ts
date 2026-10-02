import type { Moneda } from '../shared/dinero';
import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';

/** Medios de cobro por defecto; el organizador puede habilitar otros códigos. */
export const MEDIOS_COBRO_DEFECTO = ['EFECTIVO', 'MERCADO_PAGO', 'TRANSFERENCIA', 'PIX', 'OTRO'] as const;

export interface CobroNuevo {
  readonly montoCentavos: number;
  readonly moneda: Moneda;
  readonly medio: string;
  readonly referencia?: string;
  readonly nota?: string;
  /** UUID generado en el dispositivo para idempotencia offline (ADR-0010). */
  readonly clientUuid: string;
}

export type CodigoErrorCobro =
  | 'MONTO_INVALIDO'
  | 'MONEDA_DISTINTA'
  | 'MEDIO_NO_HABILITADO'
  | 'CLIENT_UUID_INVALIDO'
  | 'MOTIVO_REQUERIDO'
  | 'COBRO_YA_ANULADO';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Valida un cobro antes de registrarlo (OR-28, OP-20). Admite cobros mayores al
 * saldo (quedan como saldo a favor) y pagos parciales (OR-29).
 */
export function validarCobro(
  cobro: CobroNuevo,
  contexto: { readonly monedaEvento: Moneda; readonly mediosHabilitados: readonly string[] },
): Result<CobroNuevo, ErrorDominio<CodigoErrorCobro>> {
  if (!Number.isSafeInteger(cobro.montoCentavos) || cobro.montoCentavos <= 0) {
    return err(errorDominio('MONTO_INVALIDO'));
  }
  if (cobro.moneda !== contexto.monedaEvento) {
    return err(errorDominio('MONEDA_DISTINTA', { esperada: contexto.monedaEvento }));
  }
  if (!contexto.mediosHabilitados.includes(cobro.medio)) {
    return err(errorDominio('MEDIO_NO_HABILITADO', { medio: cobro.medio }));
  }
  if (!UUID.test(cobro.clientUuid)) return err(errorDominio('CLIENT_UUID_INVALIDO'));
  return ok(cobro);
}

/** Monto que la interfaz propone al registrar un cobro: el saldo, nunca negativo. */
export const montoSugerido = (saldoCentavos: number): number => Math.max(0, saldoCentavos);

/** Un cobro se anula con motivo; nunca se borra (OR-30). */
export function validarAnulacion(
  motivo: string,
  yaAnulado: boolean,
): Result<{ readonly motivo: string }, ErrorDominio<CodigoErrorCobro>> {
  if (yaAnulado) return err(errorDominio('COBRO_YA_ANULADO'));
  const limpio = motivo.trim();
  if (limpio.length < 3) return err(errorDominio('MOTIVO_REQUERIDO'));
  return ok({ motivo: limpio });
}

export interface CobroRegistrado {
  readonly montoCentavos: number;
  readonly medio: string;
  readonly registradoPor: string;
  readonly anulado: boolean;
}

export interface CierreCaja {
  readonly totalCentavos: number;
  readonly cantidad: number;
  readonly porMedio: Readonly<Record<string, number>>;
  readonly porPersona: Readonly<Record<string, number>>;
  readonly anulados: { readonly cantidad: number; readonly totalCentavos: number };
}

/** Totales del turno por medio y por persona, sin anulados (OR-31, OP-21). */
export function cierreCaja(cobros: readonly CobroRegistrado[]): CierreCaja {
  const porMedio: Record<string, number> = {};
  const porPersona: Record<string, number> = {};
  let total = 0;
  let cantidad = 0;
  let anulados = 0;
  let totalAnulados = 0;
  for (const c of cobros) {
    if (c.anulado) {
      anulados += 1;
      totalAnulados += c.montoCentavos;
      continue;
    }
    total += c.montoCentavos;
    cantidad += 1;
    porMedio[c.medio] = (porMedio[c.medio] ?? 0) + c.montoCentavos;
    porPersona[c.registradoPor] = (porPersona[c.registradoPor] ?? 0) + c.montoCentavos;
  }
  return {
    totalCentavos: total,
    cantidad,
    porMedio,
    porPersona,
    anulados: { cantidad: anulados, totalCentavos: totalAnulados },
  };
}
