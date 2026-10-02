import type { Traducible } from '../shared/traducible';
import { errorDominio, type ErrorDominio } from '../shared/result';

export interface VentanaInscripcion {
  /** Instantes ISO-8601 con zona (timestamptz). */
  readonly apertura: string | null;
  readonly cierre: string | null;
  readonly cierreModificaciones: string | null;
}

/**
 * - NO_ABIERTA: antes de la apertura o sin fechas.
 * - ABIERTA: se pueden crear y modificar fichas.
 * - SOLO_MODIFICACIONES: no se crean fichas nuevas; se modifican las existentes.
 * - CERRADA: solo solicitudes de modificación (PR-20).
 */
export type EstadoVentana = 'NO_ABIERTA' | 'ABIERTA' | 'SOLO_MODIFICACIONES' | 'CERRADA';

export function estadoVentana(v: VentanaInscripcion, ahora: Date): EstadoVentana {
  const t = ahora.getTime();
  const ms = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));
  const apertura = ms(v.apertura);
  const cierre = ms(v.cierre);
  const cierreMod = ms(v.cierreModificaciones) ?? cierre;
  if (apertura === null || t < apertura) return 'NO_ABIERTA';
  if (cierre === null || t < cierre) return 'ABIERTA';
  if (cierreMod !== null && t < cierreMod) return 'SOLO_MODIFICACIONES';
  return 'CERRADA';
}

export function puedeCrearFicha(
  v: VentanaInscripcion,
  ahora: Date,
  cupo: { readonly maximo: number | null; readonly usadas: number },
): { readonly permitido: boolean; readonly motivo?: 'VENTANA_CERRADA' | 'CUPO_AGOTADO' } {
  if (estadoVentana(v, ahora) !== 'ABIERTA') return { permitido: false, motivo: 'VENTANA_CERRADA' };
  if (cupo.maximo !== null && cupo.usadas >= cupo.maximo) return { permitido: false, motivo: 'CUPO_AGOTADO' };
  return { permitido: true };
}

export function puedeModificarFicha(v: VentanaInscripcion, ahora: Date, bloqueada: boolean): boolean {
  if (bloqueada) return false;
  const estado = estadoVentana(v, ahora);
  return estado === 'ABIERTA' || estado === 'SOLO_MODIFICACIONES';
}

export type TipoCampo = 'TEXTO' | 'NUMERO' | 'BOOLEANO' | 'FECHA' | 'OPCION';

export interface CampoAdicional {
  readonly codigo: string;
  readonly etiqueta: Traducible;
  readonly tipo: TipoCampo;
  readonly obligatorio: boolean;
  readonly opciones?: readonly string[];
}

export type CodigoErrorCampo = 'CAMPO_OBLIGATORIO' | 'TIPO_INVALIDO' | 'OPCION_INVALIDA';

const vacio = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

/** Valida los campos adicionales que configura el organizador (OR-16, PR-18). */
export function validarCamposAdicionales(
  definiciones: readonly CampoAdicional[],
  valores: Readonly<Record<string, unknown>>,
): ErrorDominio<CodigoErrorCampo>[] {
  const errores: ErrorDominio<CodigoErrorCampo>[] = [];
  for (const campo of definiciones) {
    const valor = valores[campo.codigo];
    if (vacio(valor)) {
      if (campo.obligatorio) errores.push(errorDominio('CAMPO_OBLIGATORIO', { campo: campo.codigo }));
      continue;
    }
    const tipoOk =
      (campo.tipo === 'TEXTO' && typeof valor === 'string') ||
      (campo.tipo === 'NUMERO' && typeof valor === 'number' && Number.isFinite(valor)) ||
      (campo.tipo === 'BOOLEANO' && typeof valor === 'boolean') ||
      (campo.tipo === 'FECHA' && typeof valor === 'string' && !Number.isNaN(Date.parse(valor))) ||
      (campo.tipo === 'OPCION' && typeof valor === 'string');
    if (!tipoOk) {
      errores.push(errorDominio('TIPO_INVALIDO', { campo: campo.codigo }));
      continue;
    }
    if (campo.tipo === 'OPCION' && !(campo.opciones ?? []).includes(valor as string)) {
      errores.push(errorDominio('OPCION_INVALIDA', { campo: campo.codigo }));
    }
  }
  return errores;
}
