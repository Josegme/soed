import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';
import type {
  Ajuste,
  CalculoLiquidacion,
  EstadoLiquidacion,
  FichaALiquidar,
  FiltroCoreografia,
  InscripcionALiquidar,
  LineaLiquidacion,
  Tarifario,
} from './tipos';

export interface OpcionesLiquidacion {
  /**
   * Incluye borradores para el total en vivo que ve la academia mientras carga
   * (PR-13). La liquidación emitida solo cobra fichas enviadas.
   */
  readonly incluirBorradores?: boolean;
}

/** Las fichas retiradas nunca se cobran; los borradores solo en la vista previa. */
const fichasCobrables = (fichas: readonly FichaALiquidar[], opciones: OpcionesLiquidacion): FichaALiquidar[] =>
  fichas.filter((f) => f.estado !== 'RETIRADA' && (opciones.incluirBorradores || f.estado !== 'BORRADOR'));

const cumpleFiltro = (f: FichaALiquidar, filtro: FiltroCoreografia): boolean =>
  (!filtro.formacion || filtro.formacion === f.formacion) &&
  (!filtro.genero || filtro.genero === f.genero) &&
  (!filtro.categoria || filtro.categoria === f.categoria);

const redondear = (centavos: number): number => Math.round(centavos + Number.EPSILON);

function factorFicha(tarifario: Tarifario, ficha: FichaALiquidar): number {
  return (tarifario.recargos ?? [])
    .filter((r) => r.tipo === 'MULTIPLICADOR_COREOGRAFIA' && cumpleFiltro(ficha, r.filtro))
    .reduce((acc, r) => acc * (r.tipo === 'MULTIPLICADOR_COREOGRAFIA' ? r.factor : 1), 1);
}

function linea(concepto: LineaLiquidacion['concepto'], cantidad: number, precioUnitario: number, referencia?: string): LineaLiquidacion {
  const importe = redondear(cantidad * precioUnitario);
  return referencia === undefined
    ? { concepto, cantidad, precioUnitario, importe }
    : { concepto, referencia, cantidad, precioUnitario, importe };
}

function lineasBase(tarifario: Tarifario, inscripcion: InscripcionALiquidar, opciones: OpcionesLiquidacion): LineaLiquidacion[] {
  const fichas = fichasCobrables(inscripcion.fichas, opciones);
  const lineas: LineaLiquidacion[] = [];

  if (tarifario.fijoAcademia) lineas.push(linea('FIJO_ACADEMIA', 1, tarifario.fijoAcademia.precio));

  if (tarifario.porBailarin) {
    const distintos = new Set(fichas.flatMap((f) => f.integrantes.map((i) => i.bailarinId)));
    if (distintos.size > 0) lineas.push(linea('POR_BAILARIN', distintos.size, tarifario.porBailarin.precio));
  }

  if (tarifario.porCoreografia) {
    const pc = tarifario.porCoreografia;
    for (const f of fichas) {
      const precio = pc.porFormacion?.[f.formacion] ?? pc.precioBase;
      lineas.push(linea('POR_COREOGRAFIA', factorFicha(tarifario, f), precio, f.id));
    }
  }

  if (tarifario.porParticipacion) {
    const { precio, desdeNumero } = tarifario.porParticipacion;
    const participaciones = new Map<string, number>();
    for (const f of fichas) {
      let cobradas = 0;
      for (const i of f.integrantes) {
        const n = (participaciones.get(i.bailarinId) ?? 0) + 1;
        participaciones.set(i.bailarinId, n);
        if (n >= desdeNumero) cobradas += 1;
      }
      if (cobradas > 0) lineas.push(linea('POR_PARTICIPACION', cobradas * factorFicha(tarifario, f), precio, f.id));
    }
  }

  for (const recargo of tarifario.recargos ?? []) {
    if (recargo.tipo === 'MONTO_POR_COREOGRAFIA') {
      const n = fichas.filter((f) => cumpleFiltro(f, recargo.filtro)).length;
      if (n > 0) lineas.push(linea('RECARGO', n, recargo.monto, recargo.codigo));
    }
    if (recargo.tipo === 'MONTO_POR_BAILARIN') {
      const coreografos = new Set(fichas.flatMap((f) => f.integrantes.filter((i) => i.esCoreografo).map((i) => i.bailarinId)));
      if (coreografos.size > 0) lineas.push(linea('RECARGO', coreografos.size, recargo.monto, recargo.codigo));
    }
  }
  return lineas;
}

export type CodigoErrorLiquidacion = 'RUBRO_DESCONOCIDO' | 'CANTIDAD_INVALIDA' | 'AJUSTE_INVALIDO';

function validarAjuste(a: Ajuste): boolean {
  if (!a.motivo.trim()) return false;
  switch (a.tipo) {
    case 'SIN_CARGO':
      return true;
    case 'MONTO_LIBRE':
    case 'DESCUENTO_MONTO':
      return Number.isSafeInteger(a.monto) && a.monto >= 0;
    case 'DESCUENTO_PORCENTAJE':
      return a.porcentaje > 0 && a.porcentaje <= 100;
  }
}

/**
 * Calcula la liquidación de una academia en un evento (PR-13, OR-06, TR-18).
 * Función pura; el total nunca es negativo. Los ajustes se aplican en orden:
 * SIN_CARGO y MONTO_LIBRE fijan el total; los descuentos lo reducen.
 */
export function calcularLiquidacion(
  tarifario: Tarifario,
  inscripcion: InscripcionALiquidar,
  opciones: OpcionesLiquidacion = {},
): Result<CalculoLiquidacion, ErrorDominio<CodigoErrorLiquidacion>> {
  const lineas = lineasBase(tarifario, inscripcion, opciones);

  for (const r of inscripcion.rubros) {
    if (!Number.isInteger(r.cantidad) || r.cantidad < 0) {
      return err(errorDominio('CANTIDAD_INVALIDA', { rubro: r.codigo }));
    }
    const rubro = tarifario.rubros?.find((x) => x.codigo === r.codigo);
    if (!rubro) return err(errorDominio('RUBRO_DESCONOCIDO', { rubro: r.codigo }));
    if (r.cantidad > 0) lineas.push(linea('RUBRO', r.cantidad, rubro.precioUnitario, rubro.codigo));
  }

  const subtotal = lineas.reduce((acc, l) => acc + l.importe, 0);
  let total = subtotal;
  for (const a of inscripcion.ajustes) {
    if (!validarAjuste(a)) return err(errorDominio('AJUSTE_INVALIDO', { tipo: a.tipo }));
    const antes = total;
    switch (a.tipo) {
      case 'SIN_CARGO':
        total = 0;
        break;
      case 'MONTO_LIBRE':
        total = a.monto;
        break;
      case 'DESCUENTO_PORCENTAJE':
        total = total - redondear((total * a.porcentaje) / 100);
        break;
      case 'DESCUENTO_MONTO':
        total = total - a.monto;
        break;
    }
    total = Math.max(0, total);
    lineas.push({ concepto: 'AJUSTE', referencia: a.tipo, cantidad: 1, precioUnitario: total - antes, importe: total - antes });
  }

  return ok({ moneda: tarifario.moneda, lineas, subtotal, total });
}

/** Estado derivado de la liquidación (TR-19). Ningún estado bloquea la participación (TR-12). */
export function estadoLiquidacion(totalCentavos: number, cobradoCentavos: number): EstadoLiquidacion {
  if (totalCentavos <= 0) return 'SIN_CARGO';
  if (cobradoCentavos <= 0) return 'PENDIENTE';
  if (cobradoCentavos < totalCentavos) return 'PARCIAL';
  return 'PAGADA';
}

/** Saldo pendiente; negativo si se cobró de más (saldo a favor). */
export const saldoLiquidacion = (totalCentavos: number, cobradoCentavos: number): number => totalCentavos - cobradoCentavos;

const PATRON_SLUG = /^[A-Z0-9]{2,16}$/;

export const esSlugNumeracionValido = (slug: string): boolean => PATRON_SLUG.test(slug);

/** Número visible de la liquidación: LIQ-<SLUG>-0001 (TR-15). */
export function formatearNumeroLiquidacion(slug: string, correlativo: number): string {
  const s = slug.toUpperCase();
  if (!PATRON_SLUG.test(s)) throw new Error(`Slug de numeración inválido: ${slug}`);
  if (!Number.isInteger(correlativo) || correlativo < 1) throw new Error(`Correlativo inválido: ${correlativo}`);
  return `LIQ-${s}-${String(correlativo).padStart(4, '0')}`;
}
