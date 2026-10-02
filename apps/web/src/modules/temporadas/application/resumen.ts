/**
 * Tablero de temporada del Super Admin (SA-10, SA-11). Cada evento cobra en su
 * moneda: los totales se agregan por moneda y nunca se convierten.
 */

export interface CobranzaEvento {
  eventoId: string;
  moneda: string;
  esperado: number;
  cobrado: number;
  pendiente: number;
  liquidaciones: number;
}

export interface MetricasEvento {
  eventoId: string;
  academias: number;
  fichas: number;
  fichasAprobadas: number;
  cobranza: CobranzaEvento[];
}

export interface TotalMoneda {
  moneda: string;
  esperado: number;
  cobrado: number;
  pendiente: number;
  /** Porcentaje cobrado sobre lo esperado (0 a 100, entero). */
  avance: number;
}

export interface ResumenTemporada {
  eventos: MetricasEvento[];
  academias: number;
  fichas: number;
  totales: TotalMoneda[];
}

export interface DatosResumen {
  eventoIds: readonly string[];
  inscripciones: readonly { eventoId: string; academiaId: string }[];
  fichas: readonly { eventoId: string; estado: string }[];
  cobranza: readonly CobranzaEvento[];
}

const contar = <T>(items: readonly T[], clave: (i: T) => string) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(clave(i), (m.get(clave(i)) ?? 0) + 1);
  return m;
};

/** Fichas que cuentan como participación: las enviadas y aprobadas (no borradores ni retiradas). */
const PARTICIPA = new Set(['ENVIADA', 'OBSERVADA', 'APROBADA']);

export function resumirTemporada(datos: DatosResumen): ResumenTemporada {
  const academiasPorEvento = contar(datos.inscripciones, (i) => i.eventoId);
  const participan = datos.fichas.filter((f) => PARTICIPA.has(f.estado));
  const fichasPorEvento = contar(participan, (f) => f.eventoId);
  const aprobadasPorEvento = contar(
    participan.filter((f) => f.estado === 'APROBADA'),
    (f) => f.eventoId,
  );
  const totales = new Map<string, TotalMoneda>();
  for (const c of datos.cobranza) {
    const t = totales.get(c.moneda) ?? { moneda: c.moneda, esperado: 0, cobrado: 0, pendiente: 0, avance: 0 };
    t.esperado += c.esperado;
    t.cobrado += c.cobrado;
    t.pendiente += c.pendiente;
    totales.set(c.moneda, t);
  }
  return {
    eventos: datos.eventoIds.map((id) => ({
      eventoId: id,
      academias: academiasPorEvento.get(id) ?? 0,
      fichas: fichasPorEvento.get(id) ?? 0,
      fichasAprobadas: aprobadasPorEvento.get(id) ?? 0,
      cobranza: datos.cobranza.filter((c) => c.eventoId === id),
    })),
    // Una academia que participa en varios eventos cuenta una sola vez en la temporada.
    academias: new Set(datos.inscripciones.map((i) => i.academiaId)).size,
    fichas: participan.length,
    totales: [...totales.values()]
      .map((t) => ({ ...t, avance: t.esperado > 0 ? Math.min(100, Math.floor((t.cobrado * 100) / t.esperado)) : 0 }))
      .sort((a, b) => a.moneda.localeCompare(b.moneda)),
  };
}

export interface FilaHistorial {
  academiaId: string;
  academia: string;
  coreografiaId: string | null;
  coreografia: string;
  eventoId: string;
  grupo: string;
  puesto: number;
  puntaje: number;
  banda: string | null;
  /** Eventos destino de los pases vigentes desde este evento (de la coreografía o de la academia entera). */
  pases: string[];
}

/**
 * Historial de la temporada (SA-15): resultados por academia y coreografía con
 * los pases registrados. Ordena por academia, coreografía y fecha del evento.
 */
export function historialTemporada(
  resultados: readonly Omit<FilaHistorial, 'pases'>[],
  pases: readonly { origenId: string | null; destino: string; academiaId: string; coreografiaId: string | null }[],
  ordenEventos: readonly string[],
): FilaHistorial[] {
  const posicion = new Map(ordenEventos.map((id, i) => [id, i]));
  return resultados
    .map((r) => ({
      ...r,
      pases: pases
        .filter(
          (p) =>
            p.origenId === r.eventoId && p.academiaId === r.academiaId && (p.coreografiaId === null || p.coreografiaId === r.coreografiaId),
        )
        .map((p) => p.destino),
    }))
    .sort(
      (a, b) =>
        a.academia.localeCompare(b.academia) ||
        a.coreografia.localeCompare(b.coreografia) ||
        (posicion.get(a.eventoId) ?? 0) - (posicion.get(b.eventoId) ?? 0),
    );
}
