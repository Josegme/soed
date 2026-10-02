import 'server-only';
import { asignarHotel, type AsignacionHotel, type CriterioHotel, type Traducible } from '@soed/domain';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';

export interface Hotel {
  id: string;
  nombre: string;
  descripcion: Traducible;
  cupo: number;
  precio: number | null;
  criterio: CriterioHotel;
}

type FilaHotel = {
  id: string;
  nombre: string;
  descripcion: unknown;
  cupo: number;
  precio_centavos: number | null;
  criterio_asignacion: string;
};

const aHotel = (h: FilaHotel): Hotel => ({
  id: h.id,
  nombre: h.nombre,
  descripcion: (h.descripcion ?? {}) as Traducible,
  cupo: h.cupo,
  precio: h.precio_centavos === null ? null : Number(h.precio_centavos),
  criterio: h.criterio_asignacion as CriterioHotel,
});

const COLUMNAS = 'id, nombre, descripcion, cupo, precio_centavos, criterio_asignacion';

interface SolicitudConDatos {
  id: string;
  hotelId: string;
  inscripcionId: string;
  academiaId: string;
  plazas: number;
  creadoAt: string;
  inscriptaAt: string;
  primerPagoAt: string | null;
}

/** Solicitudes del evento con fecha de inscripción y primer pago, leídas con el cliente dado. */
async function solicitudesConDatos(db: ClienteSupabase, eventoId: string): Promise<SolicitudConDatos[]> {
  const [{ data: solicitudes }, { data: inscripciones }, { data: liquidaciones }] = await Promise.all([
    db.from('hotel_solicitud').select('id, hotel_id, inscripcion_id, academia_id, plazas, creado_at').eq('evento_id', eventoId),
    db.from('inscripcion').select('id, inscripta_at').eq('evento_id', eventoId),
    db.from('v_liquidacion_estado').select('inscripcion_id, primer_pago_at').eq('evento_id', eventoId),
  ]);
  const inscriptaAt = new Map((inscripciones ?? []).map((i) => [i.id, i.inscripta_at]));
  const primerPago = new Map((liquidaciones ?? []).map((l) => [l.inscripcion_id ?? '', l.primer_pago_at]));
  return (solicitudes ?? []).map((s) => ({
    id: s.id,
    hotelId: s.hotel_id,
    inscripcionId: s.inscripcion_id,
    academiaId: s.academia_id,
    plazas: s.plazas,
    creadoAt: s.creado_at,
    inscriptaAt: inscriptaAt.get(s.inscripcion_id) ?? s.creado_at,
    primerPagoAt: primerPago.get(s.inscripcion_id) ?? null,
  }));
}

function asignacionesPorHotel(hoteles: readonly Hotel[], solicitudes: readonly SolicitudConDatos[]) {
  const porInscripcion = new Map<string, Map<string, AsignacionHotel>>();
  for (const h of hoteles) {
    const asignadas = asignarHotel(
      solicitudes.filter((s) => s.hotelId === h.id),
      h.cupo,
      h.criterio,
    );
    porInscripcion.set(h.id, new Map(asignadas.map((a) => [a.inscripcionId, a])));
  }
  return porInscripcion;
}

/** Hoteles con sus solicitudes en orden de prioridad (OR-09, OR-54). RLS: inscripciones.ver. */
export async function hotelesDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data }, solicitudes] = await Promise.all([
    db.from('hotel').select(COLUMNAS).eq('evento_id', eventoId).order('nombre'),
    solicitudesConDatos(db, eventoId),
  ]);
  const hoteles = (data ?? []).map(aHotel);
  const ids = [...new Set(solicitudes.map((s) => s.academiaId))];
  const { data: academias } = ids.length ? await db.from('academia').select('id, nombre').in('id', ids) : { data: [] };
  const nombre = new Map((academias ?? []).map((a) => [a.id, a.nombre]));
  const asignaciones = asignacionesPorHotel(hoteles, solicitudes);
  return hoteles.map((h) => {
    const delHotel = asignaciones.get(h.id) ?? new Map<string, AsignacionHotel>();
    const filas = solicitudes
      .filter((s) => s.hotelId === h.id)
      .map((s) => ({ ...s, academia: nombre.get(s.academiaId) ?? '', asignacion: delHotel.get(s.inscripcionId) ?? null }))
      .sort((a, b) => (a.asignacion?.prioridad ?? 0) - (b.asignacion?.prioridad ?? 0));
    return {
      ...h,
      solicitudes: filas,
      solicitadas: filas.reduce((n, s) => n + s.plazas, 0),
      asignadas: filas.reduce((n, s) => n + (s.asignacion?.plazasAsignadas ?? 0), 0),
    };
  });
}

/**
 * Hoteles del evento y el estado de las solicitudes propias (PR-30). La
 * prioridad depende de las demás academias, que la academia no puede leer: se
 * calcula con service role y se devuelve solo la fila de la academia.
 */
export async function hotelesDeAcademia(db: ClienteSupabase, eventoId: string, academiaId: string) {
  const { data } = await db.from('hotel').select(COLUMNAS).eq('evento_id', eventoId).order('nombre');
  const hoteles = (data ?? []).map(aHotel);
  if (hoteles.length === 0) return [];
  const { data: propias } = await db
    .from('hotel_solicitud')
    .select('id, hotel_id, plazas')
    .eq('evento_id', eventoId)
    .eq('academia_id', academiaId);
  const asignaciones = (propias ?? []).length
    ? asignacionesPorHotel(hoteles, await solicitudesConDatos(supabaseAdmin(), eventoId))
    : new Map<string, Map<string, AsignacionHotel>>();
  const { data: inscripcion } = await db
    .from('inscripcion')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('academia_id', academiaId)
    .maybeSingle();
  return hoteles.map((h) => {
    const propia = (propias ?? []).find((s) => s.hotel_id === h.id) ?? null;
    return {
      ...h,
      solicitud: propia
        ? { id: propia.id, plazas: propia.plazas, asignacion: inscripcion ? (asignaciones.get(h.id)?.get(inscripcion.id) ?? null) : null }
        : null,
    };
  });
}
