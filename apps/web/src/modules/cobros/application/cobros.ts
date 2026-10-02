import {
  cierreCaja,
  err,
  errorDominio,
  ok,
  validarAnulacion,
  validarCobro,
  type CierreCaja,
  type ErrorDominio,
  type Moneda,
  type Result,
} from '@soed/domain';

export interface LiquidacionParaCobro {
  id: string;
  eventoId: string;
  academiaId: string;
  numero: string;
  moneda: Moneda;
  totalCentavos: number;
  cobradoCentavos: number;
  mediosHabilitados: string[];
}

export interface CobroParaAnular {
  id: string;
  eventoId: string;
  anulado: boolean;
}

export interface PuertosCobro {
  leerLiquidacion(liquidacionId: string): Promise<LiquidacionParaCobro | null>;
  puede(eventoId: string, permiso: 'cobros.registrar' | 'cobros.anular' | 'caja.cerrar'): boolean;
  /** Inserta con el cliente del usuario: RLS + trigger fijan autor, moneda y medio. Idempotente por clientUuid. */
  insertarCobro(datos: {
    liquidacionId: string;
    eventoId: string;
    academiaId: string;
    montoCentavos: number;
    moneda: Moneda;
    medio: string;
    referencia?: string;
    nota?: string;
    clientUuid: string;
    dispositivoAt?: string;
    turnoId?: string | null;
  }): Promise<{ id: string; duplicado: boolean }>;
  leerCobro(cobroId: string): Promise<CobroParaAnular | null>;
  anular(cobroId: string, motivo: string): Promise<void>;
  turnoAbierto(eventoId: string): Promise<string | null>;
}

export type CodigoErrorCobroApp =
  | 'LIQUIDACION_INEXISTENTE'
  | 'COBRO_INEXISTENTE'
  | 'SIN_PERMISO'
  | 'MONTO_INVALIDO'
  | 'MONEDA_DISTINTA'
  | 'MEDIO_NO_HABILITADO'
  | 'CLIENT_UUID_INVALIDO'
  | 'MOTIVO_REQUERIDO'
  | 'COBRO_YA_ANULADO';

export interface EntradaCobro {
  liquidacionId: string;
  montoCentavos: number;
  moneda: Moneda;
  medio: string;
  referencia?: string;
  nota?: string;
  clientUuid: string;
  dispositivoAt?: string;
}

/**
 * Registra un cobro en la mesa o en el panel (OR-28, OP-20). El pago nunca
 * condiciona nada más (TR-12): esta operación no toca fichas ni acreditación.
 */
export async function registrarCobro(
  p: PuertosCobro,
  e: EntradaCobro,
): Promise<Result<{ cobroId: string; saldoCentavos: number; duplicado: boolean }, ErrorDominio<CodigoErrorCobroApp>>> {
  const liq = await p.leerLiquidacion(e.liquidacionId);
  if (!liq) return err(errorDominio('LIQUIDACION_INEXISTENTE'));
  if (!p.puede(liq.eventoId, 'cobros.registrar')) return err(errorDominio('SIN_PERMISO'));
  const valido = validarCobro(
    { montoCentavos: e.montoCentavos, moneda: e.moneda, medio: e.medio, clientUuid: e.clientUuid },
    { monedaEvento: liq.moneda, mediosHabilitados: liq.mediosHabilitados },
  );
  if (!valido.ok) return err(valido.error);
  const turnoId = await p.turnoAbierto(liq.eventoId);
  const { id, duplicado } = await p.insertarCobro({ ...e, eventoId: liq.eventoId, academiaId: liq.academiaId, turnoId });
  const saldo = liq.totalCentavos - liq.cobradoCentavos - (duplicado ? 0 : e.montoCentavos);
  return ok({ cobroId: id, saldoCentavos: saldo, duplicado });
}

/** Anula con motivo; nunca borra (OR-30). */
export async function anularCobro(
  p: PuertosCobro,
  cobroId: string,
  motivo: string,
): Promise<Result<true, ErrorDominio<CodigoErrorCobroApp>>> {
  const cobro = await p.leerCobro(cobroId);
  if (!cobro) return err(errorDominio('COBRO_INEXISTENTE'));
  if (!p.puede(cobro.eventoId, 'cobros.anular')) return err(errorDominio('SIN_PERMISO'));
  const v = validarAnulacion(motivo, cobro.anulado);
  if (!v.ok) return err(v.error);
  await p.anular(cobroId, v.value.motivo);
  return ok(true);
}

export interface CobroDeCaja {
  montoCentavos: number;
  medio: string;
  registradoPor: string;
  anulado: boolean;
}

/** Totales del turno o del evento por medio y por persona (OR-31). */
export function resumenCaja(cobros: readonly CobroDeCaja[]): CierreCaja {
  return cierreCaja(cobros);
}
