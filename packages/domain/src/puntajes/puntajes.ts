import type { Banda, CampoAgrupacion, ConfigPuntaje } from '../reglamento/tipos';
import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';

export interface Criterio {
  readonly codigo: string;
  readonly peso: number;
}

export interface Nota {
  readonly criterio: string;
  readonly valor: number;
}

export type CodigoErrorPuntaje = 'NOTA_FUERA_DE_ESCALA' | 'DECIMALES_EXCEDIDOS' | 'CRITERIO_FALTANTE' | 'CRITERIO_DESCONOCIDO';

/**
 * Redondeo decimal mitad hacia arriba (simétrico) sin el error binario de
 * `Math.round(x * 100) / 100` (8.995 → 8.99). Primero limpia el ruido de las
 * operaciones previas con 12 dígitos significativos y luego desplaza la coma
 * por exponente, que es exacto.
 */
export function redondear(valor: number, decimales: number): number {
  if (!Number.isFinite(valor)) return valor;
  const signo = valor < 0 ? -1 : 1;
  const limpio = Math.abs(Number(valor.toPrecision(12)));
  const [mantisa, exponente = '0'] = String(limpio).split('e');
  const entero = Math.round(Number(`${mantisa}e${Number(exponente) + decimales}`));
  const [m2, e2 = '0'] = String(entero).split('e');
  const resultado = Number(`${m2}e${Number(e2) - decimales}`);
  return resultado === 0 ? 0 : signo * resultado;
}

function decimalesDe(valor: number): number {
  const texto = String(valor);
  if (texto.includes('e-')) return Number(texto.split('e-')[1]);
  return texto.includes('.') ? (texto.split('.')[1]?.length ?? 0) : 0;
}

/** Valida una nota contra la escala configurada (JU-03). */
export function validarNota(valor: number, config: ConfigPuntaje): Result<number, ErrorDominio<CodigoErrorPuntaje>> {
  if (!Number.isFinite(valor) || valor < config.escalaMin || valor > config.escalaMax) {
    return err(errorDominio('NOTA_FUERA_DE_ESCALA', { min: config.escalaMin, max: config.escalaMax }));
  }
  if (decimalesDe(valor) > config.decimalesNota) {
    return err(errorDominio('DECIMALES_EXCEDIDOS', { decimales: config.decimalesNota }));
  }
  return ok(valor);
}

/**
 * Total de una planilla: promedio ponderado por peso de criterio. Exige una nota
 * válida por cada criterio del evento.
 */
export function totalPlanilla(
  notas: readonly Nota[],
  criterios: readonly Criterio[],
  config: ConfigPuntaje,
): Result<number, ErrorDominio<CodigoErrorPuntaje>> {
  for (const n of notas) {
    if (!criterios.some((c) => c.codigo === n.criterio)) {
      return err(errorDominio('CRITERIO_DESCONOCIDO', { criterio: n.criterio }));
    }
  }
  let suma = 0;
  let pesos = 0;
  for (const c of criterios) {
    const nota = notas.find((n) => n.criterio === c.codigo);
    if (!nota) return err(errorDominio('CRITERIO_FALTANTE', { criterio: c.codigo }));
    const valida = validarNota(nota.valor, config);
    if (!valida.ok) return valida;
    suma += nota.valor * c.peso;
    pesos += c.peso;
  }
  return ok(pesos === 0 ? 0 : suma / pesos);
}

/**
 * Puntaje final de una ficha a partir de los totales de cada jurado. Con
 * PROMEDIO_SIN_EXTREMOS y al menos tres jurados descarta el más alto y el más
 * bajo; con menos jurados usa el promedio simple.
 */
export function puntajeFinal(totales: readonly number[], config: ConfigPuntaje): number | null {
  if (totales.length === 0) return null;
  let considerados = [...totales].sort((a, b) => a - b);
  if (config.agregacion === 'PROMEDIO_SIN_EXTREMOS' && considerados.length >= 3) {
    considerados = considerados.slice(1, -1);
  }
  const promedio = considerados.reduce((a, b) => a + b, 0) / considerados.length;
  return redondear(promedio, config.decimalesResultado);
}

/** Banda de clasificación (TR-08): la primera cuyo umbral se alcanza; null = sin banda. */
export function banda(puntaje: number, bandas: readonly Banda[]): Banda | null {
  return [...bandas].sort((a, b) => b.umbral - a.umbral).find((b) => puntaje >= b.umbral) ?? null;
}

export interface TotalJurado {
  readonly juradoId: string;
  readonly total: number;
}

export interface Desvio {
  readonly juradoId: string;
  readonly total: number;
  readonly promedioResto: number;
  readonly diferencia: number;
}

/**
 * Jurados cuyo total se aparta del promedio de los demás más que el umbral
 * (OP-02). Se compara contra el resto para que el propio desvío no lo oculte.
 */
export function detectarDesvios(totales: readonly TotalJurado[], umbral: number): Desvio[] {
  if (totales.length < 2) return [];
  return totales.flatMap((t) => {
    const resto = totales.filter((o) => o.juradoId !== t.juradoId);
    const promedioResto = resto.reduce((a, o) => a + o.total, 0) / resto.length;
    const diferencia = redondear(t.total - promedioResto, 4);
    return Math.abs(diferencia) > umbral ? [{ juradoId: t.juradoId, total: t.total, promedioResto: redondear(promedioResto, 4), diferencia }] : [];
  });
}

export interface ResultadoFicha {
  readonly fichaId: string;
  readonly categoria: string;
  readonly formacion: string;
  readonly genero: string;
  readonly puntaje: number;
  /** Valores de desempate por prioridad (por ejemplo, notas de criterios clave). */
  readonly desempate?: readonly number[];
}

export interface PuestoFicha {
  readonly fichaId: string;
  readonly grupo: string;
  readonly puesto: number;
}

export const claveGrupo = (r: ResultadoFicha, agrupacion: readonly CampoAgrupacion[]): string =>
  agrupacion.map((campo) => r[campo]).join('|') || 'GENERAL';

function compararDesempate(a: readonly number[] = [], b: readonly number[] = []): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Ranking por grupo (OR-41). Mismo puntaje y mismo desempate → mismo puesto
 * (ranking de competición 1, 1, 3). El sistema no decide pases (TR-13).
 */
export function ranking(resultados: readonly ResultadoFicha[], agrupacion: readonly CampoAgrupacion[]): PuestoFicha[] {
  const grupos = new Map<string, ResultadoFicha[]>();
  for (const r of resultados) {
    const clave = claveGrupo(r, agrupacion);
    grupos.set(clave, [...(grupos.get(clave) ?? []), r]);
  }
  const salida: PuestoFicha[] = [];
  for (const [grupo, lista] of grupos) {
    const ordenada = [...lista].sort(
      (a, b) => b.puntaje - a.puntaje || compararDesempate(a.desempate, b.desempate) || a.fichaId.localeCompare(b.fichaId),
    );
    ordenada.forEach((r, i) => {
      const anterior = ordenada[i - 1];
      const empatado =
        anterior !== undefined &&
        anterior.puntaje === r.puntaje &&
        compararDesempate(anterior.desempate, r.desempate) === 0;
      const puestoAnterior = salida[salida.length - 1]?.puesto ?? 1;
      salida.push({ fichaId: r.fichaId, grupo, puesto: empatado ? puestoAnterior : i + 1 });
    });
  }
  return salida;
}
