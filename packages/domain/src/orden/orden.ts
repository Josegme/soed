import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';

export const ESTADOS_ORDEN = ['PROGRAMADA', 'LLAMADA', 'EN_ESCENA', 'PRESENTADA', 'AUSENTE'] as const;
export type EstadoOrden = (typeof ESTADOS_ORDEN)[number];

export interface ItemOrden {
  readonly id: string;
  readonly fichaId: string;
  readonly bloqueId: string;
  readonly posicion: number;
  readonly estado: EstadoOrden;
  readonly duracionSegundos?: number | null;
}

/** Transiciones permitidas en vivo (OP-07). Volver atrás corrige errores del operador. */
const TRANSICIONES: Readonly<Record<EstadoOrden, readonly EstadoOrden[]>> = {
  PROGRAMADA: ['LLAMADA', 'EN_ESCENA', 'AUSENTE'],
  LLAMADA: ['PROGRAMADA', 'EN_ESCENA', 'AUSENTE'],
  EN_ESCENA: ['LLAMADA', 'PRESENTADA'],
  PRESENTADA: ['EN_ESCENA'],
  AUSENTE: ['PROGRAMADA', 'LLAMADA'],
};

export type CodigoErrorOrden = 'TRANSICION_INVALIDA' | 'ITEM_INEXISTENTE' | 'POSICION_INVALIDA';

export function transicionEstado(desde: EstadoOrden, hacia: EstadoOrden): Result<EstadoOrden, ErrorDominio<CodigoErrorOrden>> {
  return TRANSICIONES[desde].includes(hacia) ? ok(hacia) : err(errorDominio('TRANSICION_INVALIDA', { desde, hacia }));
}

const porPosicion = (items: readonly ItemOrden[]): ItemOrden[] => [...items].sort((a, b) => a.posicion - b.posicion);

const renumerar = (items: readonly ItemOrden[]): ItemOrden[] =>
  items.map((item, i) => (item.posicion === i + 1 ? item : { ...item, posicion: i + 1 }));

/**
 * Mueve un ítem a una nueva posición dentro de su bloque (1-based) y renumera
 * de forma contigua (OR-38, OP-08).
 */
export function reordenar(
  items: readonly ItemOrden[],
  itemId: string,
  nuevaPosicion: number,
): Result<ItemOrden[], ErrorDominio<CodigoErrorOrden>> {
  const ordenados = porPosicion(items);
  const indice = ordenados.findIndex((i) => i.id === itemId);
  if (indice < 0) return err(errorDominio('ITEM_INEXISTENTE', { itemId }));
  if (!Number.isInteger(nuevaPosicion) || nuevaPosicion < 1 || nuevaPosicion > ordenados.length) {
    return err(errorDominio('POSICION_INVALIDA', { posicion: nuevaPosicion }));
  }
  const [item] = ordenados.splice(indice, 1);
  if (!item) return err(errorDominio('ITEM_INEXISTENTE', { itemId }));
  ordenados.splice(nuevaPosicion - 1, 0, item);
  return ok(renumerar(ordenados));
}

/** Mueve un ítem a otro bloque o pista en una posición dada (OP-09). */
export function moverABloque(
  origen: readonly ItemOrden[],
  destino: readonly ItemOrden[],
  itemId: string,
  bloqueDestinoId: string,
  posicion: number,
): Result<{ origen: ItemOrden[]; destino: ItemOrden[] }, ErrorDominio<CodigoErrorOrden>> {
  const item = origen.find((i) => i.id === itemId);
  if (!item) return err(errorDominio('ITEM_INEXISTENTE', { itemId }));
  const ordenDestino = porPosicion(destino);
  if (!Number.isInteger(posicion) || posicion < 1 || posicion > ordenDestino.length + 1) {
    return err(errorDominio('POSICION_INVALIDA', { posicion }));
  }
  ordenDestino.splice(posicion - 1, 0, { ...item, bloqueId: bloqueDestinoId });
  return ok({
    origen: renumerar(porPosicion(origen.filter((i) => i.id !== itemId))),
    destino: renumerar(ordenDestino),
  });
}

export interface HorarioEstimado {
  readonly itemId: string;
  readonly inicio: Date;
}

/**
 * Hora estimada de cada ítem pendiente a partir del inicio del bloque o de la
 * hora actual si ya empezó (OP-10). Presentadas y ausentes no consumen tiempo.
 */
export function horarioEstimado(
  items: readonly ItemOrden[],
  inicioBloque: Date,
  opciones: { readonly intervaloSegundos: number; readonly duracionPorDefectoSegundos: number; readonly ahora?: Date },
): HorarioEstimado[] {
  const base = opciones.ahora && opciones.ahora > inicioBloque ? opciones.ahora : inicioBloque;
  let cursor = base.getTime();
  const resultado: HorarioEstimado[] = [];
  for (const item of porPosicion(items)) {
    if (item.estado === 'PRESENTADA' || item.estado === 'AUSENTE') continue;
    resultado.push({ itemId: item.id, inicio: new Date(cursor) });
    const duracion = item.duracionSegundos ?? opciones.duracionPorDefectoSegundos;
    cursor += (duracion + opciones.intervaloSegundos) * 1000;
  }
  return resultado;
}

export interface FichaParaOrden {
  readonly fichaId: string;
  readonly categoriaOrden: number;
  readonly formacion: string;
  readonly genero: string;
  readonly academia: string;
}

/**
 * Propuesta inicial de orden (OR-37): agrupa por categoría (de menor a mayor
 * edad), formación y género; dentro del grupo separa coreografías de la misma
 * academia cuando es posible para dar tiempo de cambio de vestuario.
 */
export function proponerOrden(fichas: readonly FichaParaOrden[], ordenFormaciones: readonly string[]): string[] {
  const rangoFormacion = (f: string): number => {
    const i = ordenFormaciones.indexOf(f);
    return i < 0 ? ordenFormaciones.length : i;
  };
  const grupos = new Map<string, FichaParaOrden[]>();
  const ordenadas = [...fichas].sort(
    (a, b) =>
      a.categoriaOrden - b.categoriaOrden ||
      rangoFormacion(a.formacion) - rangoFormacion(b.formacion) ||
      a.genero.localeCompare(b.genero) ||
      a.fichaId.localeCompare(b.fichaId),
  );
  for (const f of ordenadas) {
    const clave = `${f.categoriaOrden}|${f.formacion}|${f.genero}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), f]);
  }
  const resultado: string[] = [];
  for (const grupo of grupos.values()) {
    const pendientes = [...grupo];
    let ultimaAcademia: string | null = null;
    while (pendientes.length > 0) {
      const indice = pendientes.findIndex((f) => f.academia !== ultimaAcademia);
      const elegida = pendientes.splice(indice < 0 ? 0 : indice, 1)[0];
      if (!elegida) break;
      resultado.push(elegida.fichaId);
      ultimaAcademia = elegida.academia;
    }
  }
  return resultado;
}
