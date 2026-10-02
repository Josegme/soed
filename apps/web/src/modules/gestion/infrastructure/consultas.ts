import 'server-only';
import type { Infraccion, ReglamentoEvento, Traducible } from '@soed/domain';
import { reglamentoSchema } from '@soed/shared-types';
import { cache } from 'react';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { ordenEnVivo } from '@/modules/vivo/infrastructure/consultas';

/**
 * Lecturas de los paneles de gestión con el cliente del usuario: RLS decide qué
 * filas ve cada rol, así que estas consultas no filtran por permiso.
 */

export const eventoDeGestion = cache(async (db: ClienteSupabase, eventoId: string) => {
  const { data } = await db.from('evento').select('*').eq('id', eventoId).maybeSingle();
  if (!data) return null;
  const r = reglamentoSchema.safeParse(data.reglamento);
  return {
    ...data,
    nombre: data.nombre as Traducible,
    reglamentoValido: r.success,
    reglamentoTipado: r.success ? (r.data as ReglamentoEvento) : null,
  };
});
export type EventoGestion = NonNullable<Awaited<ReturnType<typeof eventoDeGestion>>>;

export async function resumenGestion(db: ClienteSupabase, eventoId: string) {
  const [fichas, inscripciones, cobranza, solicitudes, planillas] = await Promise.all([
    db.from('ficha').select('estado, bloqueada').eq('evento_id', eventoId),
    db.from('inscripcion').select('academia_id', { count: 'exact', head: true }).eq('evento_id', eventoId),
    db.from('v_resumen_cobranza').select('*').eq('evento_id', eventoId),
    db.from('solicitud_modificacion').select('id', { count: 'exact', head: true }).eq('evento_id', eventoId).eq('estado', 'PENDIENTE'),
    db.from('planilla').select('estado').eq('evento_id', eventoId),
  ]);
  const porEstado: Record<string, number> = {};
  for (const f of fichas.data ?? []) porEstado[f.estado] = (porEstado[f.estado] ?? 0) + 1;
  return {
    fichasPorEstado: porEstado,
    fichasTotal: fichas.data?.length ?? 0,
    bloqueadas: (fichas.data ?? []).filter((f) => f.bloqueada).length,
    academias: inscripciones.count ?? 0,
    cobranza: cobranza.data ?? [],
    solicitudesPendientes: solicitudes.count ?? 0,
    planillasEnviadas: (planillas.data ?? []).filter((p) => p.estado === 'ENVIADA').length,
    planillasTotal: planillas.data?.length ?? 0,
  };
}

export interface FiltrosFichas {
  estado?: string;
  academiaId?: string;
  q?: string;
}

export async function fichasDeGestion(db: ClienteSupabase, eventoId: string, filtros: FiltrosFichas = {}) {
  let consulta = db
    .from('ficha')
    .select(
      'id, nombre, estado, genero, formacion, categoria, categoria_declarada, bloqueada, observacion, excepcion, validacion, musica_path, musica_duracion_seg, academia_id, ficha_bailarin (nombre_mostrado, edad, categoria)',
    )
    .eq('evento_id', eventoId)
    .order('creado_at');
  if (filtros.estado) consulta = consulta.eq('estado', filtros.estado);
  if (filtros.academiaId) consulta = consulta.eq('academia_id', filtros.academiaId);
  if (filtros.q) consulta = consulta.ilike('nombre', `%${filtros.q.replace(/[%_]/g, '')}%`);
  const [{ data }, academias] = await Promise.all([consulta, nombresDeAcademias(db, eventoId)]);
  return (data ?? []).map((f) => {
    const v = f.validacion as { valida?: boolean; infracciones?: Infraccion[]; advertencias?: Infraccion[] } | null;
    return {
      id: f.id,
      nombre: f.nombre,
      estado: f.estado,
      genero: f.genero,
      formacion: f.formacion,
      categoria: f.categoria,
      bloqueada: f.bloqueada,
      observacion: f.observacion,
      excepcion: f.excepcion as { motivo: string; por: string; at: string } | null,
      valida: v ? v.valida === true : null,
      infracciones: v?.infracciones ?? [],
      advertencias: v?.advertencias ?? [],
      tieneMusica: !!f.musica_path,
      duracion: f.musica_duracion_seg,
      academiaId: f.academia_id,
      academia: academias.get(f.academia_id) ?? '',
      elenco: f.ficha_bailarin.map((b) => ({ nombre: b.nombre_mostrado, edad: b.edad, categoria: b.categoria })),
    };
  });
}

export async function academiasDelEvento(db: ClienteSupabase, eventoId: string) {
  const { data } = await db.from('inscripcion').select('academia:academia_id (id, nombre, ciudad, pais)').eq('evento_id', eventoId);
  return (data ?? []).flatMap((i) => (i.academia ? [i.academia] : [])).sort((a, b) => a.nombre.localeCompare(b.nombre));
}

export async function nombresDeAcademias(db: ClienteSupabase, eventoId: string) {
  return new Map((await academiasDelEvento(db, eventoId)).map((a) => [a.id, a.nombre]));
}

export async function solicitudesDeGestion(db: ClienteSupabase, eventoId: string) {
  const { data } = await db
    .from('solicitud_modificacion')
    .select(
      'id, descripcion, estado, respuesta, creado_at, academia_id, ficha!solicitud_modificacion_ficha_id_evento_id_academia_id_fkey (nombre)',
    )
    .eq('evento_id', eventoId)
    .order('creado_at', { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function liquidacionesDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: liq }, academias] = await Promise.all([
    db.from('v_liquidacion_estado').select('*').eq('evento_id', eventoId).order('numero'),
    academiasDelEvento(db, eventoId),
  ]);
  const nombre = new Map(academias.map((a) => [a.id, a.nombre]));
  return (liq ?? []).map((l) => ({
    id: l.liquidacion_id!,
    numero: l.numero ?? '',
    academiaId: l.academia_id ?? '',
    academia: nombre.get(l.academia_id ?? '') ?? '',
    version: l.version,
    total: Number(l.total_centavos ?? 0),
    cobrado: Number(l.cobrado_centavos ?? 0),
    saldo: Number(l.saldo_centavos ?? 0),
    estado: l.estado ?? 'PENDIENTE',
  }));
}

export async function cobrosDeGestion(db: ClienteSupabase, eventoId: string, limite = 200) {
  const { data } = await db
    .from('cobro')
    .select(
      'id, liquidacion_id, monto_centavos, moneda, medio, referencia, nota, registrado_por, registrado_at, anulado_at, motivo_anulacion, turno_caja_id',
    )
    .eq('evento_id', eventoId)
    .order('registrado_at', { ascending: false })
    .limit(limite);
  return data ?? [];
}

export async function turnosDeCaja(db: ClienteSupabase, eventoId: string) {
  const { data } = await db
    .from('turno_caja')
    .select('id, usuario_id, abierto_at, cerrado_at, resumen')
    .eq('evento_id', eventoId)
    .order('abierto_at', { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Nombres de usuarios visibles para quien gestiona el equipo (perfil_equipo_lectura). */
export async function nombresDeUsuarios(db: ClienteSupabase, ids: readonly string[]) {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (unicos.length === 0) return new Map<string, string>();
  const { data } = await db.from('perfil').select('id, nombre, email').in('id', unicos);
  return new Map((data ?? []).map((p) => [p.id, p.nombre || p.email || '']));
}

/** Orden completo para la gestión: misma lectura que las vistas en vivo. */
export async function ordenDeGestion(db: ClienteSupabase, eventoId: string) {
  return ordenEnVivo(db, eventoId);
}

export async function fichasSinOrden(db: ClienteSupabase, eventoId: string) {
  const { data } = await db.from('ficha').select('id, orden_item (id)').eq('evento_id', eventoId).in('estado', ['ENVIADA', 'APROBADA']);
  return (data ?? []).filter((f) => f.orden_item.length === 0).length;
}

export async function puntajesDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: criterios }, { data: planillas }, { data: resultados }, { data: fichas }] = await Promise.all([
    db.from('criterio').select('id, codigo, nombre, peso, orden').eq('evento_id', eventoId).order('orden'),
    db.from('planilla').select('id, ficha_id, jurado_id, estado, total, motivo_reapertura').eq('evento_id', eventoId),
    db
      .from('resultado')
      .select('ficha_id, puntaje, banda, grupo, puesto, calculado_at')
      .eq('evento_id', eventoId)
      .order('grupo')
      .order('puesto'),
    db
      .from('ficha')
      .select('id, nombre, categoria, formacion, genero, academia_id')
      .eq('evento_id', eventoId)
      .in('estado', ['ENVIADA', 'APROBADA']),
  ]);
  const academias = await nombresDeAcademias(db, eventoId);
  const fichaPorId = new Map((fichas ?? []).map((f) => [f.id, f]));
  return {
    criterios: (criterios ?? []).map((c) => ({ ...c, nombre: c.nombre as Traducible, peso: Number(c.peso) })),
    planillas: (planillas ?? []).map((p) => ({ ...p, total: p.total === null ? null : Number(p.total) })),
    fichas: (fichas ?? []).map((f) => ({ ...f, academia: academias.get(f.academia_id) ?? '' })),
    resultados: (resultados ?? []).map((r) => ({
      ...r,
      puntaje: Number(r.puntaje),
      ficha: fichaPorId.get(r.ficha_id)?.nombre ?? '',
      academia: academias.get(fichaPorId.get(r.ficha_id)?.academia_id ?? '') ?? '',
    })),
  };
}

export async function pasesDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: pases }, { data: destinos }] = await Promise.all([
    db
      .from('pase')
      .select(
        'id, evento_destino_id, academia_id, coreografia_id, motivo, beneficio, registrado_at, anulado_at, motivo_anulacion, academia:academia_id (nombre), coreografia!pase_coreografia_id_academia_id_fkey (nombre)',
      )
      .eq('evento_origen_id', eventoId)
      .order('registrado_at', { ascending: false }),
    db.rpc('eventos_destino_pase', { p_origen: eventoId }),
  ]);
  return {
    pases: pases ?? [],
    destinos: (destinos ?? []).map((d) => ({ ...d, nombre: d.nombre as Traducible })),
  };
}

export async function coreografiasDelEvento(db: ClienteSupabase, eventoId: string) {
  const { data } = await db
    .from('ficha')
    .select('coreografia_id, nombre, academia_id')
    .eq('evento_id', eventoId)
    .neq('estado', 'RETIRADA')
    .order('nombre');
  return data ?? [];
}

export async function comunicadosDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: comunicados }, { data: envios }] = await Promise.all([
    db
      .from('comunicado')
      .select('id, asunto, audiencia, estado, creado_at, enviado_at')
      .eq('evento_id', eventoId)
      .order('creado_at', { ascending: false }),
    db.from('email_envio').select('estado, payload').eq('evento_id', eventoId).eq('plantilla', 'comunicado'),
  ]);
  const estadisticas = new Map<string, Record<string, number>>();
  for (const e of envios ?? []) {
    const id = (e.payload as { comunicadoId?: string } | null)?.comunicadoId;
    if (!id) continue;
    const s = estadisticas.get(id) ?? {};
    s[e.estado] = (s[e.estado] ?? 0) + 1;
    estadisticas.set(id, s);
  }
  return (comunicados ?? []).map((c) => ({ ...c, asunto: c.asunto as Traducible, envios: estadisticas.get(c.id) ?? {} }));
}

export async function equipoDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: miembros }, { data: roles }] = await Promise.all([
    db.from('evento_miembro').select('usuario_id, rol, activo, asignado_at').eq('evento_id', eventoId).eq('activo', true).order('rol'),
    db.from('rol').select('codigo, nombre, orden').order('orden'),
  ]);
  const nombres = await nombresDeUsuarios(
    db,
    (miembros ?? []).map((m) => m.usuario_id),
  );
  const { data: perfiles } = await db
    .from('perfil')
    .select('id, email')
    .in('id', [...nombres.keys()]);
  const emails = new Map((perfiles ?? []).map((p) => [p.id, p.email ?? '']));
  return {
    miembros: (miembros ?? []).map((m) => ({ ...m, nombre: nombres.get(m.usuario_id) ?? '', email: emails.get(m.usuario_id) ?? '' })),
    roles: (roles ?? []).map((r) => ({ codigo: r.codigo, nombre: r.nombre as Traducible })),
  };
}

export async function auditoriaDeGestion(db: ClienteSupabase, eventoId: string, opciones: { tabla?: string; pagina?: number } = {}) {
  const porPagina = 50;
  const pagina = Math.max(1, opciones.pagina ?? 1);
  let consulta = db
    .from('auditoria')
    .select('id, ocurrido_at, usuario_id, tabla, registro_id, accion, antes, despues', { count: 'exact' })
    .eq('evento_id', eventoId)
    .order('id', { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1);
  if (opciones.tabla) consulta = consulta.eq('tabla', opciones.tabla);
  const { data, count } = await consulta;
  const nombres = await nombresDeUsuarios(
    db,
    (data ?? []).map((a) => a.usuario_id ?? ''),
  );
  return {
    filas: (data ?? []).map((a) => ({ ...a, usuario: a.usuario_id ? (nombres.get(a.usuario_id) ?? a.usuario_id.slice(0, 8)) : null })),
    total: count ?? 0,
    pagina,
    paginas: Math.max(1, Math.ceil((count ?? 0) / porPagina)),
  };
}

/** Inscripciones con su liquidación y ajustes vigentes (ajustes y becas, OR-25/OR-26). */
export async function inscripcionesConAjustes(db: ClienteSupabase, eventoId: string) {
  const [{ data: inscripciones }, { data: ajustes }, { data: liquidaciones }, academias] = await Promise.all([
    db.from('inscripcion').select('id, academia_id').eq('evento_id', eventoId),
    db
      .from('ajuste_liquidacion')
      .select('id, inscripcion_id, tipo, monto_centavos, porcentaje, motivo, creado_at')
      .eq('evento_id', eventoId)
      .is('anulado_at', null)
      .order('creado_at'),
    db.from('v_liquidacion_estado').select('inscripcion_id, numero, version').eq('evento_id', eventoId),
    nombresDeAcademias(db, eventoId),
  ]);
  return (inscripciones ?? [])
    .map((i) => {
      const liq = (liquidaciones ?? []).find((l) => l.inscripcion_id === i.id);
      return {
        id: i.id,
        academia: academias.get(i.academia_id) ?? '',
        numero: liq?.numero ?? null,
        version: liq?.version ?? null,
        ajustes: (ajustes ?? [])
          .filter((a) => a.inscripcion_id === i.id)
          .map((a) => ({
            ...a,
            monto_centavos: a.monto_centavos === null ? null : Number(a.monto_centavos),
            porcentaje: a.porcentaje === null ? null : Number(a.porcentaje),
          })),
      };
    })
    .sort((a, b) => a.academia.localeCompare(b.academia));
}
