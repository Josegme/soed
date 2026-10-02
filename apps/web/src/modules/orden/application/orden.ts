import {
  err,
  errorDominio,
  ok,
  proponerOrden,
  transicionEstado,
  type ErrorDominio,
  type EstadoOrden,
  type FichaParaOrden,
  type Result,
} from '@soed/domain';

export interface PuertosOrden {
  puede(eventoId: string, permiso: 'orden.editar' | 'orden.operar'): boolean;
  /** Fichas enviadas o aprobadas que todavía no están en el orden. */
  fichasSinOrden(eventoId: string): Promise<FichaParaOrden[]>;
  ordenFormaciones(eventoId: string): Promise<string[]>;
  ultimaPosicion(bloqueId: string): Promise<number>;
  bloque(bloqueId: string): Promise<{ id: string; eventoId: string; pistaId: string } | null>;
  insertarItems(items: { eventoId: string; pistaId: string; bloqueId: string; fichaId: string; posicion: number }[]): Promise<void>;
  item(itemId: string): Promise<{ id: string; eventoId: string; estado: EstadoOrden } | null>;
  actualizarEstado(itemId: string, estado: EstadoOrden): Promise<void>;
  /** Pone en LLAMADA/PROGRAMADA la que estaba en escena en la misma pista antes de subir otra. */
  liberarEscena(itemId: string): Promise<void>;
  /** Ítems de una pista en orden de salida (bloque y posición). */
  itemsDePista(pistaId: string): Promise<{ id: string; eventoId: string; estado: EstadoOrden }[]>;
}

export type CodigoErrorOrdenApp = 'SIN_PERMISO' | 'BLOQUE_INEXISTENTE' | 'ITEM_INEXISTENTE' | 'TRANSICION_INVALIDA' | 'SIN_FICHAS';

/**
 * Agrega al final de un bloque las fichas aún sin orden, en el orden que
 * propone el dominio (categoría, formación, género; academias alternadas).
 */
export async function asignarFichasABloque(
  p: PuertosOrden,
  bloqueId: string,
): Promise<Result<{ agregadas: number }, ErrorDominio<CodigoErrorOrdenApp>>> {
  const bloque = await p.bloque(bloqueId);
  if (!bloque) return err(errorDominio('BLOQUE_INEXISTENTE'));
  if (!p.puede(bloque.eventoId, 'orden.editar')) return err(errorDominio('SIN_PERMISO'));
  const fichas = await p.fichasSinOrden(bloque.eventoId);
  if (fichas.length === 0) return err(errorDominio('SIN_FICHAS'));
  const orden = proponerOrden(fichas, await p.ordenFormaciones(bloque.eventoId));
  const desde = await p.ultimaPosicion(bloqueId);
  await p.insertarItems(
    orden.map((fichaId, i) => ({ eventoId: bloque.eventoId, pistaId: bloque.pistaId, bloqueId, fichaId, posicion: desde + i + 1 })),
  );
  return ok({ agregadas: orden.length });
}

/** Cambio de estado en vivo con transiciones del dominio (OP-07). Una sola coreografía en escena por pista. */
export async function cambiarEstadoOrden(
  p: PuertosOrden,
  itemId: string,
  estado: EstadoOrden,
): Promise<Result<EstadoOrden, ErrorDominio<CodigoErrorOrdenApp>>> {
  const item = await p.item(itemId);
  if (!item) return err(errorDominio('ITEM_INEXISTENTE'));
  if (!p.puede(item.eventoId, 'orden.operar')) return err(errorDominio('SIN_PERMISO'));
  const t = transicionEstado(item.estado, estado);
  if (!t.ok) return err(errorDominio('TRANSICION_INVALIDA', t.error.params));
  if (estado === 'EN_ESCENA') await p.liberarEscena(itemId);
  await p.actualizarEstado(itemId, estado);
  return ok(estado);
}

/**
 * "Siguiente" del coordinador (OP-05, OP-06): la que está en escena pasa a
 * presentada, sube la llamada (o la próxima programada) y se llama a la que
 * sigue. Las ausentes y presentadas se saltean.
 */
export async function avanzarOrden(
  p: PuertosOrden,
  pistaId: string,
): Promise<Result<{ enEscena: string | null; llamada: string | null }, ErrorDominio<CodigoErrorOrdenApp>>> {
  const items = await p.itemsDePista(pistaId);
  if (items.length === 0) return err(errorDominio('ITEM_INEXISTENTE'));
  if (!p.puede(items[0]!.eventoId, 'orden.operar')) return err(errorDominio('SIN_PERMISO'));
  const actual = items.findIndex((i) => i.estado === 'EN_ESCENA');
  if (actual >= 0) await p.actualizarEstado(items[actual]!.id, 'PRESENTADA');
  const pendientes = items.filter((i, n) => n > actual && (i.estado === 'LLAMADA' || i.estado === 'PROGRAMADA'));
  const siguiente = pendientes.find((i) => i.estado === 'LLAMADA') ?? pendientes[0] ?? null;
  if (siguiente) await p.actualizarEstado(siguiente.id, 'EN_ESCENA');
  const proxima = pendientes.find((i) => i.id !== siguiente?.id) ?? null;
  if (proxima?.estado === 'PROGRAMADA') await p.actualizarEstado(proxima.id, 'LLAMADA');
  return ok({ enEscena: siguiente?.id ?? null, llamada: proxima?.id ?? null });
}
