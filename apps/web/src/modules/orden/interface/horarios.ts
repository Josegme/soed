import { horarioEstimado, type EstadoOrden } from '@soed/domain';

/** Parámetros operativos del evento (`evento.config_operacion`). */
export interface ConfigOperacion {
  intervaloSegundos?: number;
  duracionPorDefectoSegundos?: number;
}

interface BloqueConItems {
  id: string;
  inicio: string | null;
  items: readonly { id: string; fichaId: string; posicion: number; estado: string; duracion: number | null }[];
}

/**
 * Hora estimada de cada ítem del bloque (OP-10) a partir de su inicio
 * programado; null si el bloque no tiene horario.
 */
export function horariosDeBloque(bloque: BloqueConItems, config: ConfigOperacion): Map<string, Date> | null {
  if (!bloque.inicio) return null;
  const horarios = horarioEstimado(
    bloque.items.map((i) => ({
      id: i.id,
      fichaId: i.fichaId,
      bloqueId: bloque.id,
      posicion: i.posicion,
      estado: i.estado as EstadoOrden,
      duracionSegundos: i.duracion,
    })),
    new Date(bloque.inicio),
    {
      intervaloSegundos: config.intervaloSegundos ?? 60,
      duracionPorDefectoSegundos: config.duracionPorDefectoSegundos ?? 240,
    },
  );
  return new Map(horarios.map((h) => [h.itemId, h.inicio]));
}
