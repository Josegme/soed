import 'server-only';
import type { ReglamentoEvento, ResultadoValidacion, Traducible } from '@soed/domain';
import type { Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';

/** Academia activa: la pedida por ?a= si el usuario es miembro; si no, la primera. */
export function academiaActiva(sesion: Sesion, pedida?: string | null) {
  return sesion.academias.find((a) => a.id === pedida) ?? sesion.academias[0] ?? null;
}

export async function datosAcademia(db: ClienteSupabase, id: string) {
  const { data } = await db.from('academia').select('id, nombre, ciudad, region, pais, email, telefono').eq('id', id).maybeSingle();
  return data;
}

export async function resumenAcademia(db: ClienteSupabase, id: string) {
  const [b, c, i] = await Promise.all([
    db.from('bailarin').select('id', { count: 'exact', head: true }).eq('academia_id', id).eq('activo', true),
    db.from('coreografia').select('id', { count: 'exact', head: true }).eq('academia_id', id).eq('activa', true),
    db.from('inscripcion').select('evento_id').eq('academia_id', id).eq('estado', 'ACTIVA'),
  ]);
  return { bailarines: b.count ?? 0, coreografias: c.count ?? 0, eventosInscriptos: new Set((i.data ?? []).map((x) => x.evento_id)) };
}

export async function listarBailarines(db: ClienteSupabase, academiaId: string) {
  const { data } = await db
    .from('bailarin')
    .select('id, nombre, apellido, fecha_nacimiento, documento_tipo, documento_numero, activo')
    .eq('academia_id', academiaId)
    .order('apellido')
    .order('nombre');
  return data ?? [];
}

export async function listarCoreografias(db: ClienteSupabase, academiaId: string) {
  const { data } = await db
    .from('coreografia')
    .select(
      'id, nombre, genero, formacion, coreografo, musica_path, musica_nombre, musica_duracion_seg, activa, coreografia_bailarin (bailarin_id, es_coreografo)',
    )
    .eq('academia_id', academiaId)
    .eq('activa', true)
    .order('nombre');
  return data ?? [];
}

/** Reglamento de referencia para crear coreografías: el de la temporada publicada más reciente. */
export async function reglamentoDeReferencia(db: ClienteSupabase): Promise<ReglamentoEvento | null> {
  const { data } = await db
    .from('temporada')
    .select('anio, reglamento:reglamento_id (config)')
    .eq('publicada', true)
    .order('anio', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.reglamento?.config) return data.reglamento.config as unknown as ReglamentoEvento;
  const { data: preset } = await db.from('reglamento').select('config').order('creado_at').limit(1).maybeSingle();
  return (preset?.config as unknown as ReglamentoEvento) ?? null;
}

export async function eventosPublicadosParaAcademia(db: ClienteSupabase) {
  const { data } = await db
    .from('evento')
    .select(
      'id, slug, tipo, nombre, idioma_defecto, fecha_inicio, fecha_fin, inscripcion_apertura, inscripcion_cierre, modificaciones_cierre, sede',
    )
    .eq('publicado', true)
    .order('fecha_inicio');
  return data ?? [];
}

export async function pasesDeAcademia(db: ClienteSupabase, academiaId: string) {
  const { data } = await db
    .from('pase')
    .select('id, motivo, beneficio, registrado_at, evento_destino:evento_destino_id (nombre, idioma_defecto, slug)')
    .eq('academia_id', academiaId)
    .is('anulado_at', null)
    .order('registrado_at', { ascending: false });
  return data ?? [];
}

export async function comunicadosDeAcademia(db: ClienteSupabase) {
  const { data } = await db
    .from('comunicado')
    .select('id, asunto, cuerpo, enviado_at, evento_id')
    .eq('estado', 'ENVIADO')
    .order('enviado_at', { ascending: false })
    .limit(10);
  return data ?? [];
}

export interface FichaDeAcademia {
  id: string;
  nombre: string;
  genero: string;
  formacion: string;
  categoria: string | null;
  categoriaDeclarada: string | null;
  estado: string;
  bloqueada: boolean;
  observacion: string | null;
  validacion: ResultadoValidacion | null;
  musicaDuracion: number | null;
  coreografiaId: string;
  elenco: { bailarinId: string; nombre: string; edad: number | null; categoria: string | null }[];
}

/** Todo lo que la academia necesita para gestionar su inscripción a un evento. */
export async function inscripcionDeAcademia(db: ClienteSupabase, slug: string, academiaId: string) {
  const { data: evento } = await db
    .from('evento')
    .select(
      'id, slug, tipo, nombre, idioma_defecto, moneda, zona_horaria, fecha_inicio, fecha_fin, inscripcion_apertura, inscripcion_cierre, modificaciones_cierre, reglamento, tarifario, datos_pago, orden_publicado_at, resultados_publicados_at, publicado',
    )
    .eq('slug', slug.toUpperCase())
    .maybeSingle();
  if (!evento) return null;
  const { data: inscripcion } = await db
    .from('inscripcion')
    .select('id, estado, rubros, inscripta_at')
    .eq('evento_id', evento.id)
    .eq('academia_id', academiaId)
    .maybeSingle();
  let fichas: FichaDeAcademia[] = [];
  let liquidacion = null;
  let devoluciones: {
    ficha_id: string | null;
    jurado_numero: number | null;
    total: number | null;
    comentario: string | null;
    notas: unknown;
  }[] = [];
  let orden: {
    ficha_id: string;
    posicion: number;
    estado: string;
    bloque: { nombre: unknown; inicio_programado: string | null } | null;
  }[] = [];
  if (inscripcion) {
    const { data } = await db
      .from('ficha')
      .select(
        'id, nombre, genero, formacion, categoria, categoria_declarada, estado, bloqueada, observacion, validacion, musica_duracion_seg, coreografia_id, ficha_bailarin (bailarin_id, nombre_mostrado, edad, categoria)',
      )
      .eq('inscripcion_id', inscripcion.id)
      .order('creado_at');
    fichas = (data ?? []).map((f) => ({
      id: f.id,
      nombre: f.nombre,
      genero: f.genero,
      formacion: f.formacion,
      categoria: f.categoria,
      categoriaDeclarada: f.categoria_declarada,
      estado: f.estado,
      bloqueada: f.bloqueada,
      observacion: f.observacion,
      validacion: normalizarValidacion(f.validacion),
      musicaDuracion: f.musica_duracion_seg,
      coreografiaId: f.coreografia_id,
      elenco: f.ficha_bailarin.map((b) => ({ bailarinId: b.bailarin_id, nombre: b.nombre_mostrado, edad: b.edad, categoria: b.categoria })),
    }));
    const [liq, dev, ord] = await Promise.all([
      db.from('v_liquidacion_estado').select('*').eq('inscripcion_id', inscripcion.id).maybeSingle(),
      db.from('v_devolucion_jurado').select('ficha_id, jurado_numero, total, comentario, notas').eq('evento_id', evento.id),
      db
        .from('orden_item')
        .select('ficha_id, posicion, estado, bloque:bloque!orden_item_bloque_id_evento_id_fkey (nombre, inicio_programado)')
        .eq('evento_id', evento.id)
        .order('posicion'),
    ]);
    liquidacion = liq.data;
    devoluciones = (dev.data ?? []) as typeof devoluciones;
    orden = (ord.data ?? []) as typeof orden;
  }
  return {
    evento: {
      ...evento,
      nombre: evento.nombre as Traducible,
      reglamento: evento.reglamento as unknown as ReglamentoEvento,
      datos_pago: evento.datos_pago as Traducible,
    },
    inscripcion,
    fichas,
    liquidacion,
    devoluciones,
    orden,
  };
}

/** Profesores de la academia e invitaciones pendientes (estas solo las ve la titular, por RLS). */
export async function equipoDeAcademia(db: ClienteSupabase, academiaId: string) {
  const [{ data: miembros }, { data: invitaciones }] = await Promise.all([
    db.from('academia_miembro').select('usuario_id, rol, activo').eq('academia_id', academiaId).eq('activo', true),
    db
      .from('academia_invitacion')
      .select('id, email, vence_at, aceptada_at')
      .eq('academia_id', academiaId)
      .is('aceptada_at', null)
      .order('creado_at'),
  ]);
  const ids = (miembros ?? []).map((m) => m.usuario_id);
  const { data: perfiles } = ids.length ? await db.from('perfil').select('id, nombre, email').in('id', ids) : { data: [] };
  const perfil = new Map((perfiles ?? []).map((p) => [p.id, p]));
  return {
    miembros: (miembros ?? []).map((m) => ({
      ...m,
      nombre: perfil.get(m.usuario_id)?.nombre ?? '',
      email: perfil.get(m.usuario_id)?.email ?? '',
    })),
    invitaciones: invitaciones ?? [],
  };
}

/**
 * La validación vive en un jsonb: se normaliza su forma para que una fila
 * antigua o parcial nunca rompa la pantalla (arrays siempre presentes).
 */
export function normalizarValidacion(valor: unknown): ResultadoValidacion | null {
  if (!valor || typeof valor !== 'object') return null;
  const v = valor as Partial<ResultadoValidacion>;
  return {
    categoria: v.categoria ?? null,
    categoriasSugeridas: Array.isArray(v.categoriasSugeridas) ? v.categoriasSugeridas : [],
    integrantes: Array.isArray(v.integrantes) ? v.integrantes : [],
    infracciones: Array.isArray(v.infracciones) ? v.infracciones : [],
    advertencias: Array.isArray(v.advertencias) ? v.advertencias : [],
    tiempoMaximoSegundos: v.tiempoMaximoSegundos ?? null,
    toleranciaSegundos: v.toleranciaSegundos ?? 0,
    valida: v.valida === true,
  };
}
