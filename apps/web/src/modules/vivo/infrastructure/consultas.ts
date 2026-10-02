import 'server-only';
import type { ConfigPuntaje, Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

/**
 * Lecturas de las vistas en vivo (coordinador, locutor, DJ, jurado, director
 * técnico). Los nombres de academia se leen por id: los roles operativos no
 * ven inscripciones, pero sí las academias del orden (academia_lectura).
 */
export async function academiasPorId(db: ClienteSupabase, ids: readonly string[]) {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (unicos.length === 0) return new Map<string, { nombre: string; ciudad: string | null }>();
  const { data } = await db.from('academia').select('id, nombre, ciudad').in('id', unicos);
  return new Map((data ?? []).map((a) => [a.id, { nombre: a.nombre, ciudad: a.ciudad }]));
}

export interface ItemEnVivo {
  id: string;
  posicion: number;
  estado: string;
  fichaId: string;
  nombre: string;
  academia: string;
  ciudad: string | null;
  categoria: string | null;
  formacion: string;
  genero: string;
  duracion: number | null;
  musicaPath: string | null;
}

export interface BloqueEnVivo {
  id: string;
  nombre: Traducible;
  inicio: string | null;
  items: ItemEnVivo[];
}

export interface PistaEnVivo {
  id: string;
  nombre: Traducible;
  bloques: BloqueEnVivo[];
}

export async function ordenEnVivo(db: ClienteSupabase, eventoId: string): Promise<PistaEnVivo[]> {
  const [{ data: pistas }, { data: bloques }, { data: items }] = await Promise.all([
    db.from('pista').select('id, nombre, orden').eq('evento_id', eventoId).order('orden'),
    db.from('bloque').select('id, pista_id, nombre, inicio_programado, orden').eq('evento_id', eventoId).order('orden'),
    db
      .from('orden_item')
      .select(
        'id, bloque_id, posicion, estado, ficha:ficha_id (id, nombre, categoria, formacion, genero, musica_duracion_seg, musica_path, academia_id)',
      )
      .eq('evento_id', eventoId)
      .order('posicion'),
  ]);
  const academias = await academiasPorId(
    db,
    (items ?? []).map((i) => i.ficha?.academia_id ?? ''),
  );
  return (pistas ?? []).map((p) => ({
    id: p.id,
    nombre: p.nombre as Traducible,
    bloques: (bloques ?? [])
      .filter((b) => b.pista_id === p.id)
      .map((b) => ({
        id: b.id,
        nombre: b.nombre as Traducible,
        inicio: b.inicio_programado,
        items: (items ?? [])
          .filter((i) => i.bloque_id === b.id)
          .map((i) => {
            const a = academias.get(i.ficha?.academia_id ?? '');
            return {
              id: i.id,
              posicion: i.posicion,
              estado: i.estado,
              fichaId: i.ficha?.id ?? '',
              nombre: i.ficha?.nombre ?? '',
              academia: a?.nombre ?? '',
              ciudad: a?.ciudad ?? null,
              categoria: i.ficha?.categoria ?? null,
              formacion: i.ficha?.formacion ?? '',
              genero: i.ficha?.genero ?? '',
              duracion: i.ficha?.musica_duracion_seg ?? null,
              musicaPath: i.ficha?.musica_path ?? null,
            };
          }),
      })),
  }));
}

/** Secuencia operativa de una pista: en escena, llamada y próximas programadas (OP-08, OP-10). */
export function secuencia(items: readonly ItemEnVivo[]) {
  const enEscena = items.find((i) => i.estado === 'EN_ESCENA') ?? null;
  const llamada = items.find((i) => i.estado === 'LLAMADA') ?? null;
  const proximas = items.filter((i) => i.estado === 'PROGRAMADA' || i.estado === 'LLAMADA');
  return { enEscena, llamada, proximas };
}

export async function criteriosDelEvento(db: ClienteSupabase, eventoId: string) {
  const { data } = await db.from('criterio').select('id, codigo, nombre, peso').eq('evento_id', eventoId).order('orden');
  return (data ?? []).map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre as Traducible, peso: Number(c.peso) }));
}

export async function configPuntaje(db: ClienteSupabase, eventoId: string): Promise<ConfigPuntaje | null> {
  const { data } = await db.from('evento').select('reglamento').eq('id', eventoId).maybeSingle();
  return (data?.reglamento as { puntaje?: ConfigPuntaje } | null)?.puntaje ?? null;
}

/** Planillas propias del jurado con sus notas (RLS: solo las suyas). */
export async function planillasDelJurado(db: ClienteSupabase, eventoId: string, juradoId: string) {
  const { data } = await db
    .from('planilla')
    .select('id, ficha_id, estado, total, comentario, motivo_reapertura, planilla_nota (criterio_id, valor)')
    .eq('evento_id', eventoId)
    .eq('jurado_id', juradoId);
  return new Map(
    (data ?? []).map((p) => [
      p.ficha_id,
      {
        id: p.id,
        estado: p.estado as 'BORRADOR' | 'ENVIADA' | 'REABIERTA',
        total: p.total === null ? null : Number(p.total),
        comentario: p.comentario,
        motivoReapertura: p.motivo_reapertura,
        notas: Object.fromEntries(p.planilla_nota.map((n) => [n.criterio_id, Number(n.valor)])),
      },
    ]),
  );
}

/** Todas las planillas del evento (supervisión: director técnico). */
export async function planillasDelEvento(db: ClienteSupabase, eventoId: string) {
  const { data } = await db.from('planilla').select('id, ficha_id, jurado_id, estado, total, enviada_at').eq('evento_id', eventoId);
  return (data ?? []).map((p) => ({ ...p, total: p.total === null ? null : Number(p.total) }));
}

export async function juradosDelEvento(db: ClienteSupabase, eventoId: string) {
  const { data: roles } = await db.from('rol_permiso').select('rol').eq('permiso', 'puntajes.cargar');
  const { data } = await db
    .from('evento_miembro')
    .select('usuario_id')
    .eq('evento_id', eventoId)
    .eq('activo', true)
    .in(
      'rol',
      (roles ?? []).map((r) => r.rol),
    );
  return [...new Set((data ?? []).map((m) => m.usuario_id))].sort();
}
