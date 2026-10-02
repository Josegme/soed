'use server';

import { ESTADOS_EVENTO, transicionEvento, type EstadoEvento } from '@soed/domain';
import {
  crearEventoSchema,
  miembroEventoSchema,
  reglamentoSchema,
  tarifarioSchema,
  traducibleRequeridoSchema,
  traducibleSchema,
  uuidSchema,
} from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { instanteDesdeLocal } from '@/lib/fechas-zona';
import { erroresDe, parsearMonto, textoDe, traducibleDe, traduciblesDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { revalidarFicha } from '@/modules/inscripciones/application/fichas';
import { puertosFichaSupabase } from '@/modules/inscripciones/infrastructure/puertos-ficha-supabase';
import { crearEvento } from '../application/crear-evento';
import { puertosEventosSupabase } from '../infrastructure/puertos-eventos-supabase';
import { usuarioIdPorEmail } from '../infrastructure/usuarios';

/**
 * Configuración del evento (organizador, OR-01 a OR-12), equipo (OR-13, SA-04)
 * y alta de temporadas y eventos (Super Admin, SA-01 a SA-03).
 */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/admin', 'layout');
  revalidatePath('/[locale]/eventos', 'layout');
};

const traducible = traducibleDe;

async function contextoEvento(datos: FormData, permiso: string) {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return null;
  const ctx = await requerirSesion();
  return tienePermiso(ctx.sesion, eventoId.data, permiso) ? { ...ctx, eventoId: eventoId.data } : null;
}

// ---------------------------------------------------------------------------
// Super Admin: temporadas y eventos
// ---------------------------------------------------------------------------

const temporadaSchema = z.object({
  anio: z.int().min(2000).max(2100),
  nombre: traducibleRequeridoSchema,
  reglamentoId: uuidSchema,
  publicada: z.boolean(),
});

export async function crearTemporadaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = temporadaSchema.safeParse({
    anio: Number(datos.get('anio')),
    nombre: traducible(datos, 'nombre'),
    reglamentoId: datos.get('reglamentoId'),
    publicada: datos.get('publicada') === 'on',
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { sesion, db } = await requerirSesion();
  if (!sesion.esSuperAdmin) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { error } = await db.from('temporada').insert({
    anio: entrada.data.anio,
    nombre: entrada.data.nombre as Json,
    reglamento_id: entrada.data.reglamentoId,
    publicada: entrada.data.publicada,
  });
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'temporadaCreada' };
}

export async function crearEventoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = crearEventoSchema.safeParse({
    temporadaId: datos.get('temporadaId'),
    slug: datos.get('slug'),
    tipo: datos.get('tipo'),
    nombre: traducible(datos, 'nombre'),
    moneda: datos.get('moneda'),
    idiomaDefecto: datos.get('idiomaDefecto'),
    zonaHoraria: datos.get('zonaHoraria'),
    fechaInicio: datos.get('fechaInicio'),
    fechaFin: datos.get('fechaFin'),
    sede: {
      venue: textoDe(datos, 'venue') ?? undefined,
      ciudad: textoDe(datos, 'ciudad') ?? undefined,
      region: textoDe(datos, 'region') ?? undefined,
      pais: textoDe(datos, 'pais') ?? undefined,
      direccion: textoDe(datos, 'direccion') ?? undefined,
    },
    clonarDeEventoId: textoDe(datos, 'clonarDeEventoId') ?? undefined,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const resultado = await intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await crearEvento(puertosEventosSupabase(db, sesion), entrada.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    refrescar();
    return { ok: true, mensaje: r.value.eventoId };
  }, valores);
  if (!resultado.ok) return resultado;
  redirect({ href: `/gestion/${resultado.mensaje}/configuracion`, locale: await getLocale() });
  return resultado;
}

// ---------------------------------------------------------------------------
// Organizador: datos, ventana, cobranza, tarifario, reglamento y estado
// ---------------------------------------------------------------------------

const datosEventoSchema = z.object({
  nombre: traducibleRequeridoSchema,
  zonaHoraria: z.string().min(3).max(64),
  idiomaDefecto: z.enum(['es', 'pt-BR']),
  fechaInicio: z.iso.date(),
  fechaFin: z.iso.date(),
  bases: traducibleSchema,
});

export async function guardarDatosEventoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const entrada = datosEventoSchema.safeParse({
    nombre: traducible(datos, 'nombre'),
    zonaHoraria: datos.get('zonaHoraria'),
    idiomaDefecto: datos.get('idiomaDefecto'),
    fechaInicio: datos.get('fechaInicio'),
    fechaFin: datos.get('fechaFin'),
    bases: traducible(datos, 'bases'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  if (entrada.data.fechaFin < entrada.data.fechaInicio) return { ok: false, errores: { fechaFin: 'FECHAS_INVALIDAS' }, valores };
  const { error } = await ctx.db
    .from('evento')
    .update({
      nombre: entrada.data.nombre as Json,
      zona_horaria: entrada.data.zonaHoraria,
      idioma_defecto: entrada.data.idiomaDefecto,
      fecha_inicio: entrada.data.fechaInicio,
      fecha_fin: entrada.data.fechaFin,
      bases: entrada.data.bases as Json,
      sede: {
        venue: textoDe(datos, 'venue'),
        ciudad: textoDe(datos, 'ciudad'),
        region: textoDe(datos, 'region'),
        pais: textoDe(datos, 'pais'),
        direccion: textoDe(datos, 'direccion'),
      },
    })
    .eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'guardado' };
}

export async function guardarVentanaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { data: evento } = await ctx.db.from('evento').select('zona_horaria').eq('id', ctx.eventoId).single();
  const zona = evento?.zona_horaria ?? 'UTC';
  const instante = (campo: string) => {
    const local = textoDe(datos, campo);
    return local ? instanteDesdeLocal(local, zona) : null;
  };
  const apertura = instante('apertura');
  const cierre = instante('cierre');
  const cierreModificaciones = instante('cierreModificaciones');
  const cupoTexto = textoDe(datos, 'cupoFichas');
  const cupo = cupoTexto ? Number(cupoTexto) : null;
  if (cupo !== null && (!Number.isInteger(cupo) || cupo <= 0)) return { ok: false, errores: { cupoFichas: 'CUPO_INVALIDO' }, valores };
  if (apertura && cierre && cierre <= apertura) return { ok: false, errores: { cierre: 'VENTANA_INVALIDA' }, valores };
  if (cierre && cierreModificaciones && cierreModificaciones < cierre)
    return { ok: false, errores: { cierreModificaciones: 'VENTANA_INVALIDA' }, valores };
  const { error } = await ctx.db
    .from('evento')
    .update({ inscripcion_apertura: apertura, inscripcion_cierre: cierre, modificaciones_cierre: cierreModificaciones, cupo_fichas: cupo })
    .eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'guardado' };
}

const cobranzaSchema = z.object({
  medios: z.array(z.string().regex(/^[A-Z_]{2,30}$/)).min(1, 'MEDIO_REQUERIDO'),
  datosPago: traducibleSchema,
});

export async function guardarCobranzaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const entrada = cobranzaSchema.safeParse({ medios: datos.getAll('medios').map(String), datosPago: traducible(datos, 'datosPago') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { error } = await ctx.db
    .from('evento')
    .update({ medios_cobro: entrada.data.medios, datos_pago: entrada.data.datosPago as Json })
    .eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'guardado' };
}

/**
 * Tarifario estructurado (OR-05): precios base, por formación y rubros. Los
 * recargos avanzados se editan como JSON validado por el mismo esquema.
 */
export async function guardarTarifarioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { data: evento } = await ctx.db.from('evento').select('moneda').eq('id', ctx.eventoId).single();
  const errores: Record<string, string> = {};
  const monto = (campo: string): number | undefined => {
    const t = textoDe(datos, campo);
    if (t === null) return undefined;
    const c = parsearMonto(t);
    if (c === null) errores[campo] = 'MONTO_INVALIDO';
    return c ?? undefined;
  };
  const porBailarin = monto('porBailarin');
  const precioBase = monto('porCoreografia');
  const porParticipacion = monto('porParticipacion');
  const fijoAcademia = monto('fijoAcademia');
  const porFormacion: Record<string, number> = {};
  for (const [k] of datos.entries()) {
    const m = /^formacion_([A-Z0-9_]+)$/.exec(k);
    const v = m ? monto(k) : undefined;
    if (m && v !== undefined) porFormacion[m[1]!] = v;
  }
  const nombresRubros = traduciblesDe(datos, 'rubro_nombre');
  const rubros = datos
    .getAll('rubro_codigo')
    .map((codigo, i) => ({
      codigo: String(codigo).trim().toUpperCase(),
      nombre: nombresRubros[i] ?? {},
      precioUnitario: parsearMonto(String(datos.getAll('rubro_precio')[i] ?? '')),
    }))
    .filter((r) => r.codigo !== '');
  if (rubros.some((r) => r.precioUnitario === null)) errores.rubros = 'MONTO_INVALIDO';
  let recargos: unknown = undefined;
  const recargosTexto = textoDe(datos, 'recargos');
  if (recargosTexto) {
    try {
      recargos = JSON.parse(recargosTexto);
    } catch {
      errores.recargos = 'JSON_INVALIDO';
    }
  }
  if (Object.keys(errores).length > 0) return { ok: false, errores, valores };
  const desdeNumero = Number(textoDe(datos, 'desdeNumero') ?? 2);
  const entrada = tarifarioSchema.safeParse({
    moneda: evento?.moneda,
    porBailarin: porBailarin !== undefined ? { precio: porBailarin } : undefined,
    porCoreografia:
      precioBase !== undefined ? { precioBase, porFormacion: Object.keys(porFormacion).length > 0 ? porFormacion : undefined } : undefined,
    porParticipacion: porParticipacion !== undefined ? { precio: porParticipacion, desdeNumero } : undefined,
    fijoAcademia: fijoAcademia !== undefined ? { precio: fijoAcademia } : undefined,
    rubros: rubros.length > 0 ? rubros : undefined,
    recargos,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { error } = await ctx.db
    .from('evento')
    .update({ tarifario: entrada.data as unknown as Json })
    .eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'tarifarioGuardado' };
}

/** Ajuste del reglamento del evento (snapshot versionado, ADR-0006). Las fichas se revalidan aparte. */
export async function guardarReglamentoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  let json: unknown;
  try {
    json = JSON.parse(String(datos.get('reglamento') ?? ''));
  } catch {
    return { ok: false, errores: { reglamento: 'JSON_INVALIDO' }, valores };
  }
  const entrada = reglamentoSchema.safeParse(json);
  if (!entrada.success) return { ok: false, mensaje: 'REGLAMENTO_INVALIDO', valores };
  const { error } = await ctx.db
    .from('evento')
    .update({ reglamento: entrada.data as unknown as Json })
    .eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'reglamentoGuardado' };
}

/** Revalida todas las fichas no retiradas con el reglamento vigente; las enviadas que dejan de cumplir quedan observadas. */
export async function revalidarFichasEventoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await contextoEvento(datos, 'inscripciones.gestionar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO' };
  return intentar(async () => {
    const { data: fichas } = await ctx.db.from('ficha').select('id').eq('evento_id', ctx.eventoId).neq('estado', 'RETIRADA');
    const puertos = puertosFichaSupabase(ctx.db, ctx.sesion);
    let invalidas = 0;
    for (const f of fichas ?? []) {
      const r = await revalidarFicha(puertos, f.id);
      if (r.ok && !r.value.valida) invalidas += 1;
    }
    refrescar();
    return { ok: true, mensaje: 'fichasRevalidadas', valores: { total: String(fichas?.length ?? 0), invalidas: String(invalidas) } };
  });
}

export async function cambiarEstadoEventoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await contextoEvento(datos, 'evento.configurar');
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO' };
  const hacia = z.enum(ESTADOS_EVENTO).safeParse(datos.get('estado'));
  if (!hacia.success) return { ok: false, mensaje: 'TRANSICION_INVALIDA' };
  const { data: evento } = await ctx.db.from('evento').select('estado, reglamento').eq('id', ctx.eventoId).single();
  if (!evento) return { ok: false, mensaje: 'EVENTO_INEXISTENTE' };
  const t = transicionEvento(evento.estado as EstadoEvento, hacia.data, ctx.sesion.esSuperAdmin);
  if (!t.ok) return { ok: false, mensaje: t.error.codigo };
  // Publicar exige un reglamento completo: es lo que ven las academias al inscribirse.
  if (t.value.publicado && !reglamentoSchema.safeParse(evento.reglamento).success) return { ok: false, mensaje: 'REGLAMENTO_INVALIDO' };
  const { error } = await ctx.db.from('evento').update({ estado: t.value.estado, publicado: t.value.publicado }).eq('id', ctx.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: `evento${t.value.estado}` };
}

// ---------------------------------------------------------------------------
// Equipo del evento
// ---------------------------------------------------------------------------

export async function agregarMiembroAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = miembroEventoSchema.safeParse({ eventoId: datos.get('eventoId'), email: textoDe(datos, 'email'), rol: datos.get('rol') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, entrada.data.eventoId, 'evento.miembros')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  if (entrada.data.rol === 'ORGANIZADOR_EVENTO' && !sesion.esSuperAdmin) return { ok: false, mensaje: 'SOLO_SUPER_ADMIN', valores };
  const usuarioId = await usuarioIdPorEmail(entrada.data.email);
  // Sin cuenta: la persona se registra primero (no se envían invitaciones a terceros desde aquí).
  if (!usuarioId) return { ok: false, mensaje: 'USUARIO_SIN_CUENTA', valores };
  const { error } = await db
    .from('evento_miembro')
    .upsert(
      { evento_id: entrada.data.eventoId, usuario_id: usuarioId, rol: entrada.data.rol, activo: true, asignado_por: sesion.usuarioId },
      { onConflict: 'evento_id,usuario_id,rol' },
    );
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'miembroAgregado' };
}

export async function quitarMiembroAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ctx = await contextoEvento(datos, 'evento.miembros');
  const usuarioId = uuidSchema.safeParse(datos.get('usuarioId'));
  const rol = z
    .string()
    .regex(/^[A-Z_]+$/)
    .safeParse(datos.get('rol'));
  if (!ctx || !usuarioId.success || !rol.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  if (usuarioId.data === ctx.sesion.usuarioId && rol.data === 'ORGANIZADOR_EVENTO') return { ok: false, mensaje: 'NO_QUITAR_PROPIO' };
  const { error } = await ctx.db
    .from('evento_miembro')
    .update({ activo: false })
    .eq('evento_id', ctx.eventoId)
    .eq('usuario_id', usuarioId.data)
    .eq('rol', rol.data);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'miembroQuitado' };
}
