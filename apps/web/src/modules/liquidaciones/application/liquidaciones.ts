import {
  ajusteDesdeBeneficio,
  calcularLiquidacion,
  err,
  errorDominio,
  ok,
  type Ajuste,
  type Beneficio,
  type CalculoLiquidacion,
  type ErrorDominio,
  type FichaALiquidar,
  type Idioma,
  type Result,
  type Tarifario,
} from '@soed/domain';

export interface InscripcionParaLiquidar {
  id: string;
  eventoId: string;
  academiaId: string;
  tarifario: Tarifario | null;
  fichas: FichaALiquidar[];
  rubros: { codigo: string; cantidad: number }[];
  ajustes: Ajuste[];
  /** Beneficios de pases vigentes hacia este evento (OR-34). */
  beneficios: { beneficio: Beneficio; motivo: string }[];
}

export interface VersionEmitida {
  version: number;
  totalCentavos: number;
  detalle: CalculoLiquidacion;
}

export interface PuertosLiquidacion {
  leerInscripcion(inscripcionId: string): Promise<InscripcionParaLiquidar | null>;
  puedeVer(inscripcion: InscripcionParaLiquidar): Promise<boolean>;
  ultimaVersion(inscripcionId: string): Promise<VersionEmitida | null>;
  /** Alta con número correlativo (RPC crear_liquidacion, solo servidor). */
  asegurarLiquidacion(inscripcionId: string): Promise<{ id: string; numero: string }>;
  insertarVersion(datos: {
    liquidacionId: string;
    eventoId: string;
    academiaId: string;
    version: number;
    calculo: CalculoLiquidacion;
    idioma: Idioma;
  }): Promise<void>;
}

export type CodigoErrorLiquidacionApp = 'INSCRIPCION_INEXISTENTE' | 'SIN_PERMISO' | 'SIN_TARIFARIO' | 'CALCULO_INVALIDO';

/**
 * Serialización con claves ordenadas: jsonb no conserva el orden de las claves,
 * así que comparar JSON.stringify del detalle guardado daría siempre distinto.
 */
export function jsonCanonico(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(jsonCanonico).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .filter((k) => (valor as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${jsonCanonico((valor as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function ajustesTotales(i: InscripcionParaLiquidar): Ajuste[] {
  return [...i.ajustes, ...i.beneficios.map((b) => ajusteDesdeBeneficio(b.beneficio, b.motivo))];
}

/** Total en vivo mientras la academia carga (incluye borradores, PR-13). */
export async function liquidacionPrevia(
  p: PuertosLiquidacion,
  inscripcionId: string,
): Promise<Result<CalculoLiquidacion, ErrorDominio<CodigoErrorLiquidacionApp>>> {
  const i = await p.leerInscripcion(inscripcionId);
  if (!i) return err(errorDominio('INSCRIPCION_INEXISTENTE'));
  if (!(await p.puedeVer(i))) return err(errorDominio('SIN_PERMISO'));
  if (!i.tarifario) return err(errorDominio('SIN_TARIFARIO'));
  const r = calcularLiquidacion(i.tarifario, { fichas: i.fichas, rubros: i.rubros, ajustes: ajustesTotales(i) }, { incluirBorradores: true });
  return r.ok ? ok(r.value) : err(errorDominio('CALCULO_INVALIDO', { causa: r.error.codigo }));
}

export interface ResultadoEmision {
  numero: string;
  version: number;
  totalCentavos: number;
  nueva: boolean;
}

/**
 * Emite la liquidación (PR-15, TR-15, TR-18): asigna número la primera vez y
 * crea una versión nueva solo si cambió el cálculo. La versión anterior queda
 * en el historial; el saldo se recalcula contra la última.
 */
export async function emitirLiquidacion(
  p: PuertosLiquidacion,
  inscripcionId: string,
  idioma: Idioma,
): Promise<Result<ResultadoEmision, ErrorDominio<CodigoErrorLiquidacionApp>>> {
  const i = await p.leerInscripcion(inscripcionId);
  if (!i) return err(errorDominio('INSCRIPCION_INEXISTENTE'));
  if (!(await p.puedeVer(i))) return err(errorDominio('SIN_PERMISO'));
  if (!i.tarifario) return err(errorDominio('SIN_TARIFARIO'));
  const calculo = calcularLiquidacion(i.tarifario, { fichas: i.fichas, rubros: i.rubros, ajustes: ajustesTotales(i) });
  if (!calculo.ok) return err(errorDominio('CALCULO_INVALIDO', { causa: calculo.error.codigo }));

  const liquidacion = await p.asegurarLiquidacion(i.id);
  const ultima = await p.ultimaVersion(i.id);
  const igual =
    ultima !== null &&
    ultima.totalCentavos === calculo.value.total &&
    jsonCanonico(ultima.detalle.lineas) === jsonCanonico(calculo.value.lineas);
  if (igual) return ok({ numero: liquidacion.numero, version: ultima.version, totalCentavos: ultima.totalCentavos, nueva: false });

  const version = (ultima?.version ?? 0) + 1;
  await p.insertarVersion({ liquidacionId: liquidacion.id, eventoId: i.eventoId, academiaId: i.academiaId, version, calculo: calculo.value, idioma });
  return ok({ numero: liquidacion.numero, version, totalCentavos: calculo.value.total, nueva: true });
}
