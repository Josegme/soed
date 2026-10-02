/**
 * Asignación de hotel por orden de inscripción y primer pago (OR-09, OR-54).
 * La regla es configurable por evento porque las Bases no definen el desempate
 * (supuesto S-08 en la auditoría).
 */
export type CriterioHotel = 'PRIMER_PAGO' | 'INSCRIPCION';

export interface SolicitudHotel {
  readonly inscripcionId: string;
  /** Instante ISO de la inscripción de la academia al evento. */
  readonly inscriptaAt: string;
  /** Instante ISO del primer cobro no anulado, o null. */
  readonly primerPagoAt: string | null;
  readonly plazas: number;
}

export interface AsignacionHotel {
  readonly inscripcionId: string;
  readonly plazasAsignadas: number;
  readonly enEspera: number;
  readonly prioridad: number;
}

function comparar(criterio: CriterioHotel) {
  return (a: SolicitudHotel, b: SolicitudHotel): number => {
    if (criterio === 'PRIMER_PAGO') {
      if (a.primerPagoAt && !b.primerPagoAt) return -1;
      if (!a.primerPagoAt && b.primerPagoAt) return 1;
      if (a.primerPagoAt && b.primerPagoAt && a.primerPagoAt !== b.primerPagoAt) {
        return a.primerPagoAt < b.primerPagoAt ? -1 : 1;
      }
    }
    if (a.inscriptaAt !== b.inscriptaAt) return a.inscriptaAt < b.inscriptaAt ? -1 : 1;
    return a.inscripcionId.localeCompare(b.inscripcionId);
  };
}

/** Asigna plazas hasta agotar el cupo; el resto queda en lista de espera en orden de prioridad. */
export function asignarHotel(
  solicitudes: readonly SolicitudHotel[],
  cupo: number,
  criterio: CriterioHotel,
): AsignacionHotel[] {
  let disponibles = Math.max(0, cupo);
  return [...solicitudes].sort(comparar(criterio)).map((s, i) => {
    const asignadas = Math.min(s.plazas, disponibles);
    disponibles -= asignadas;
    return { inscripcionId: s.inscripcionId, plazasAsignadas: asignadas, enEspera: s.plazas - asignadas, prioridad: i + 1 };
  });
}
