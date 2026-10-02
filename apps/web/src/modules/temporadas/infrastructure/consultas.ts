import 'server-only';
import type { ReglamentoEvento, Traducible } from '@soed/domain';
import { enLotes, leerTodo } from '@/lib/supabase/paginar';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { historialTemporada, resumirTemporada, type CobranzaEvento } from '../application/resumen';

/**
 * Lecturas del tablero de temporada con el cliente del usuario: la RLS solo
 * devuelve todos los eventos al Super Admin (eventos_con_permiso lo incluye).
 */
export async function eventosDeTemporada(db: ClienteSupabase, temporadaId: string) {
  const [{ data: temporada }, { data: eventos }] = await Promise.all([
    db.from('temporada').select('id, anio, nombre, publicada').eq('id', temporadaId).maybeSingle(),
    db
      .from('evento')
      .select(
        'id, slug, tipo, nombre, estado, publicado, moneda, idioma_defecto, fecha_inicio, fecha_fin, resultados_publicados_at, reglamento',
      )
      .eq('temporada_id', temporadaId)
      .order('fecha_inicio'),
  ]);
  if (!temporada) return null;
  return {
    temporada: { ...temporada, nombre: temporada.nombre as Traducible },
    eventos: (eventos ?? []).map((e) => ({
      ...e,
      nombre: e.nombre as Traducible,
      reglamento: e.reglamento as unknown as ReglamentoEvento | null,
    })),
  };
}

export async function tableroTemporada(db: ClienteSupabase, temporadaId: string) {
  const base = await eventosDeTemporada(db, temporadaId);
  if (!base) return null;
  const ids = base.eventos.map((e) => e.id);
  if (ids.length === 0) return { ...base, resumen: resumirTemporada({ eventoIds: [], inscripciones: [], fichas: [], cobranza: [] }) };
  const [inscripciones, fichas, { data: cobranza }] = await Promise.all([
    leerTodo((desde, hasta) =>
      db.from('inscripcion').select('evento_id, academia_id').in('evento_id', ids).order('id').range(desde, hasta),
    ),
    leerTodo((desde, hasta) => db.from('ficha').select('evento_id, estado').in('evento_id', ids).order('id').range(desde, hasta)),
    db.from('v_resumen_cobranza').select('*').in('evento_id', ids),
  ]);
  const resumen = resumirTemporada({
    eventoIds: ids,
    inscripciones: inscripciones.map((i) => ({ eventoId: i.evento_id, academiaId: i.academia_id })),
    fichas: fichas.map((f) => ({ eventoId: f.evento_id, estado: f.estado })),
    cobranza: (cobranza ?? []).map((c): CobranzaEvento => ({
      eventoId: c.evento_id ?? '',
      moneda: c.moneda ?? '',
      esperado: Number(c.esperado_centavos ?? 0),
      cobrado: Number(c.cobrado_centavos ?? 0),
      pendiente: Number(c.pendiente_centavos ?? 0),
      liquidaciones: Number(c.liquidaciones ?? 0),
    })),
  });
  return { ...base, resumen };
}

async function nombresAcademias(db: ClienteSupabase, ids: readonly string[]) {
  const nombres = new Map<string, string>();
  for (const lote of enLotes([...new Set(ids)])) {
    const { data } = await db.from('academia').select('id, nombre').in('id', lote);
    for (const a of data ?? []) nombres.set(a.id, a.nombre);
  }
  return nombres;
}

/** Resultados y pases de la temporada por academia y coreografía (SA-15). */
export async function historialDeTemporada(db: ClienteSupabase, temporadaId: string, filtro: { q?: string; eventoId?: string }) {
  const base = await eventosDeTemporada(db, temporadaId);
  if (!base) return null;
  const ids = base.eventos.map((e) => e.id).filter((id) => !filtro.eventoId || id === filtro.eventoId);
  if (ids.length === 0) return { ...base, filas: [] };
  const [resultados, pases] = await Promise.all([
    leerTodo((desde, hasta) =>
      db
        .from('resultado')
        .select(
          'ficha_id, evento_id, academia_id, grupo, puesto, puntaje, banda, ficha!resultado_ficha_id_evento_id_academia_id_fkey (nombre, coreografia_id)',
        )
        .in('evento_id', ids)
        .order('ficha_id')
        .range(desde, hasta),
    ),
    leerTodo((desde, hasta) =>
      db
        .from('pase')
        .select('evento_origen_id, evento_destino_id, academia_id, coreografia_id')
        .in('evento_origen_id', ids)
        .is('anulado_at', null)
        .order('id')
        .range(desde, hasta),
    ),
  ]);
  const academias = await nombresAcademias(
    db,
    resultados.map((r) => r.academia_id),
  );
  const destinos = new Map(base.eventos.map((e) => [e.id, e.slug]));
  const faltantes = pases.map((p) => p.evento_destino_id).filter((id) => !destinos.has(id));
  if (faltantes.length > 0) {
    // Una final de otra temporada no aparece en la lista: se resuelve su slug aparte.
    const { data } = await db
      .from('evento')
      .select('id, slug')
      .in('id', [...new Set(faltantes)]);
    for (const e of data ?? []) destinos.set(e.id, e.slug);
  }
  const q = filtro.q?.trim().toLocaleLowerCase();
  const filas = historialTemporada(
    resultados.map((r) => ({
      academiaId: r.academia_id,
      academia: academias.get(r.academia_id) ?? '',
      coreografiaId: r.ficha?.coreografia_id ?? null,
      coreografia: r.ficha?.nombre ?? '',
      eventoId: r.evento_id,
      grupo: r.grupo,
      puesto: r.puesto,
      puntaje: Number(r.puntaje),
      banda: r.banda,
    })),
    pases.map((p) => ({
      origenId: p.evento_origen_id,
      destino: destinos.get(p.evento_destino_id) ?? '',
      academiaId: p.academia_id,
      coreografiaId: p.coreografia_id,
    })),
    base.eventos.map((e) => e.id),
  ).filter((f) => !q || f.academia.toLocaleLowerCase().includes(q) || f.coreografia.toLocaleLowerCase().includes(q));
  return { ...base, filas };
}
