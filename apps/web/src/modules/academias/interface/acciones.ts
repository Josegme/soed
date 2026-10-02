'use server';

import type { Idioma } from '@soed/domain';
import {
  academiaSchema,
  bailarinSchema,
  coreografiaSchema,
  inscribirFichaSchema,
  musicaSchema,
  rubrosSchema,
  solicitudModificacionSchema,
  uuidSchema,
} from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { requerirSesion } from '@/lib/auth/sesion';
import { erroresDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { enviarFicha, revalidarFicha } from '@/modules/inscripciones/application/fichas';
import { puertosFichaSupabase } from '@/modules/inscripciones/infrastructure/puertos-ficha-supabase';
import { emitirLiquidacion } from '@/modules/liquidaciones/application/liquidaciones';
import { puertosLiquidacionSupabase } from '@/modules/liquidaciones/infrastructure/puertos-liquidacion-supabase';

/**
 * Server actions del panel de la academia (rol Profesor). Validan con Zod en el
 * borde (TR-31) y escriben con el cliente del usuario: RLS y triggers deciden.
 * Solo las columnas derivadas pasan por el servidor (casos de uso).
 */

const RUTA = '/[locale]/academia';
const refrescar = () => revalidatePath(RUTA, 'layout');

/** Traduce errores de Postgres (códigos de nuestros triggers) a códigos de interfaz. */
function codigoDe(error: { message?: string; code?: string } | null): string {
  if (!error) return 'INESPERADO';
  if (/^[A-Z_]+$/.test(error.message ?? '')) return error.message!;
  if (error.code === '42501') return 'SIN_PERMISO';
  return 'INESPERADO';
}

function esMiembro(academiaId: string, academias: readonly { id: string }[]): boolean {
  return academias.some((a) => a.id === academiaId);
}

export async function guardarAcademia(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = academiaSchema.safeParse(Object.fromEntries(datos));
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { sesion, db } = await requerirSesion();
  const id = uuidSchema.safeParse(datos.get('id'));
  const fila = {
    nombre: entrada.data.nombre,
    ciudad: entrada.data.ciudad ?? null,
    region: entrada.data.region ?? null,
    pais: entrada.data.pais ?? null,
    email: entrada.data.email ?? null,
    telefono: entrada.data.telefono ?? null,
  };
  const { error } = id.success
    ? await db.from('academia').update(fila).eq('id', id.data)
    : await db.from('academia').insert({ ...fila, creado_por: sesion.usuarioId });
  if (error) return { ok: false, mensaje: codigoDe(error), valores };
  refrescar();
  return { ok: true, mensaje: 'guardado' };
}

export async function guardarBailarin(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = bailarinSchema.safeParse(Object.fromEntries(datos));
  const academiaId = uuidSchema.safeParse(datos.get('academiaId'));
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  if (!academiaId.success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  if (!esMiembro(academiaId.data, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { error } = await db.from('bailarin').insert({
    academia_id: academiaId.data,
    nombre: entrada.data.nombre,
    apellido: entrada.data.apellido,
    fecha_nacimiento: entrada.data.fechaNacimiento,
    documento_tipo: entrada.data.documentoTipo ?? null,
    documento_numero: entrada.data.documentoNumero ?? null,
  });
  if (error) return { ok: false, mensaje: codigoDe(error), valores };
  refrescar();
  return { ok: true, mensaje: 'agregado' };
}

export async function cambiarActivoBailarin(bailarinId: string, activo: boolean): Promise<{ ok: boolean }> {
  if (!uuidSchema.safeParse(bailarinId).success) return { ok: false };
  const { db } = await requerirSesion();
  const { error } = await db.from('bailarin').update({ activo }).eq('id', bailarinId);
  refrescar();
  return { ok: !error };
}

export async function guardarCoreografia(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const coreografos = new Set(datos.getAll('coreografo').map(String));
  const entrada = coreografiaSchema.safeParse({
    nombre: datos.get('nombre'),
    genero: datos.get('genero'),
    formacion: datos.get('formacion'),
    coreografo: datos.get('nombreCoreografo'),
    elenco: datos.getAll('elenco').map((id) => ({ bailarinId: String(id), esCoreografo: coreografos.has(String(id)) })),
  });
  const academiaId = uuidSchema.safeParse(datos.get('academiaId'));
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  if (!academiaId.success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  if (!esMiembro(academiaId.data, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO', valores };

  const idExistente = uuidSchema.safeParse(datos.get('id'));
  const fila = {
    nombre: entrada.data.nombre,
    genero: entrada.data.genero,
    formacion: entrada.data.formacion,
    coreografo: entrada.data.coreografo ?? null,
  };
  let coreografiaId: string;
  if (idExistente.success) {
    const { error } = await db.from('coreografia').update(fila).eq('id', idExistente.data);
    if (error) return { ok: false, mensaje: codigoDe(error), valores };
    coreografiaId = idExistente.data;
    await db.from('coreografia_bailarin').delete().eq('coreografia_id', coreografiaId);
  } else {
    const { data, error } = await db.from('coreografia').insert({ ...fila, academia_id: academiaId.data }).select('id').single();
    if (error || !data) return { ok: false, mensaje: codigoDe(error), valores };
    coreografiaId = data.id;
  }
  if (entrada.data.elenco.length > 0) {
    const { error } = await db.from('coreografia_bailarin').insert(
      entrada.data.elenco.map((e) => ({
        coreografia_id: coreografiaId,
        bailarin_id: e.bailarinId,
        academia_id: academiaId.data,
        es_coreografo: e.esCoreografo,
      })),
    );
    if (error) return { ok: false, mensaje: codigoDe(error), valores };
  }
  refrescar();
  return { ok: true, mensaje: 'creada' };
}

/** Registra la música ya subida a Storage por el navegador (bucket privado, RLS por academia). */
export async function registrarMusica(entrada: unknown): Promise<{ ok: boolean; mensaje?: string }> {
  const datos = musicaSchema.safeParse(entrada);
  if (!datos.success) return { ok: false, mensaje: 'RUTA_INVALIDA' };
  const { sesion, db } = await requerirSesion();
  const academiaDeRuta = datos.data.path.split('/')[0] ?? '';
  if (!esMiembro(academiaDeRuta, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { error } = await db
    .from('coreografia')
    .update({
      musica_path: datos.data.path,
      musica_nombre: datos.data.nombre,
      musica_duracion_seg: datos.data.duracionSegundos,
      musica_subida_at: new Date().toISOString(),
    })
    .eq('id', datos.data.coreografiaId)
    .eq('academia_id', academiaDeRuta);
  refrescar();
  return error ? { ok: false, mensaje: codigoDe(error) } : { ok: true };
}

export async function inscribirAcademia(eventoId: string, academiaId: string): Promise<{ ok: boolean; mensaje?: string }> {
  if (!uuidSchema.safeParse(eventoId).success || !uuidSchema.safeParse(academiaId).success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { sesion, db } = await requerirSesion();
  if (!esMiembro(academiaId, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { error } = await db.from('inscripcion').insert({ evento_id: eventoId, academia_id: academiaId });
  refrescar();
  return error ? { ok: false, mensaje: codigoDe(error) } : { ok: true };
}

/**
 * Inscribe una coreografía (PR-10, PR-27): copia nombre, género, formación,
 * música y elenco a la ficha y la valida en el momento contra el reglamento.
 */
export async function inscribirFicha(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = inscribirFichaSchema.safeParse({
    eventoId: datos.get('eventoId'),
    academiaId: datos.get('academiaId'),
    coreografiaId: datos.get('coreografiaId'),
    categoriaDeclarada: datos.get('categoriaDeclarada') || null,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error) };
  const { sesion, db } = await requerirSesion();
  const { eventoId, academiaId, coreografiaId, categoriaDeclarada } = entrada.data;
  if (!esMiembro(academiaId, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO' };

  const [{ data: coreo }, { data: insc }] = await Promise.all([
    db
      .from('coreografia')
      .select('id, nombre, genero, formacion, musica_path, musica_duracion_seg, coreografia_bailarin (bailarin_id, es_coreografo, bailarin:bailarin!coreografia_bailarin_bailarin_id_academia_id_fkey (nombre, apellido))')
      .eq('id', coreografiaId)
      .eq('academia_id', academiaId)
      .maybeSingle(),
    db.from('inscripcion').select('id').eq('evento_id', eventoId).eq('academia_id', academiaId).maybeSingle(),
  ]);
  if (!coreo || !insc) return { ok: false, mensaje: 'SIN_PERMISO' };

  const { data: ficha, error } = await db
    .from('ficha')
    .insert({
      evento_id: eventoId,
      academia_id: academiaId,
      inscripcion_id: insc.id,
      coreografia_id: coreo.id,
      nombre: coreo.nombre,
      genero: coreo.genero,
      formacion: coreo.formacion,
      categoria_declarada: categoriaDeclarada ?? null,
      musica_path: coreo.musica_path,
      musica_duracion_seg: coreo.musica_duracion_seg,
    })
    .select('id')
    .single();
  if (error || !ficha) return { ok: false, mensaje: codigoDe(error) };

  if (coreo.coreografia_bailarin.length > 0) {
    const { error: errorElenco } = await db.from('ficha_bailarin').insert(
      coreo.coreografia_bailarin.map((cb) => ({
        ficha_id: ficha.id,
        bailarin_id: cb.bailarin_id,
        evento_id: eventoId,
        academia_id: academiaId,
        es_coreografo: cb.es_coreografo,
        nombre_mostrado: [cb.bailarin?.nombre, cb.bailarin?.apellido].filter(Boolean).join(' '),
      })),
    );
    if (errorElenco) return { ok: false, mensaje: codigoDe(errorElenco) };
  }
  await revalidarFicha(puertosFichaSupabase(db, sesion), ficha.id);
  refrescar();
  return { ok: true, mensaje: 'agregada' };
}

export async function revalidarFichaAccion(fichaId: string): Promise<{ ok: boolean; mensaje?: string }> {
  if (!uuidSchema.safeParse(fichaId).success) return { ok: false };
  const { sesion, db } = await requerirSesion();
  const r = await revalidarFicha(puertosFichaSupabase(db, sesion), fichaId);
  refrescar();
  return r.ok ? { ok: true } : { ok: false, mensaje: r.error.codigo };
}

export async function enviarFichaAccion(fichaId: string): Promise<{ ok: boolean; mensaje?: string }> {
  if (!uuidSchema.safeParse(fichaId).success) return { ok: false };
  const { sesion, db } = await requerirSesion();
  const r = await enviarFicha(puertosFichaSupabase(db, sesion), fichaId, new Date());
  refrescar();
  return r.ok ? { ok: true, mensaje: 'enviada' } : { ok: false, mensaje: r.error.codigo };
}

export async function retirarFicha(fichaId: string): Promise<{ ok: boolean; mensaje?: string }> {
  if (!uuidSchema.safeParse(fichaId).success) return { ok: false };
  const { db } = await requerirSesion();
  const { error } = await db.from('ficha').update({ estado: 'RETIRADA' }).eq('id', fichaId);
  refrescar();
  return error ? { ok: false, mensaje: codigoDe(error) } : { ok: true, mensaje: 'retirada' };
}

export async function guardarRubros(entrada: unknown): Promise<{ ok: boolean; mensaje?: string }> {
  const datos = rubrosSchema.safeParse(entrada);
  if (!datos.success) return { ok: false, mensaje: 'INESPERADO' };
  const { db } = await requerirSesion();
  const { error } = await db.from('inscripcion').update({ rubros: datos.data.rubros }).eq('id', datos.data.inscripcionId);
  refrescar();
  return error ? { ok: false, mensaje: codigoDe(error) } : { ok: true, mensaje: 'guardado' };
}

export async function emitirLiquidacionAccion(inscripcionId: string): Promise<{ ok: boolean; mensaje?: string; numero?: string; version?: number }> {
  if (!uuidSchema.safeParse(inscripcionId).success) return { ok: false };
  const { sesion, db } = await requerirSesion();
  const idioma = (await getLocale()) as Idioma;
  const r = await emitirLiquidacion(puertosLiquidacionSupabase(db, sesion), inscripcionId, idioma);
  refrescar();
  if (!r.ok) return { ok: false, mensaje: r.error.codigo };
  return { ok: true, mensaje: r.value.nueva ? 'emitida' : 'sinCambios', numero: r.value.numero, version: r.value.version };
}

export async function solicitarModificacion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = solicitudModificacionSchema.safeParse({ fichaId: datos.get('fichaId'), descripcion: datos.get('descripcion') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores: valoresDe(datos) };
  const { sesion, db } = await requerirSesion();
  const { data: ficha } = await db.from('ficha').select('id, evento_id, academia_id').eq('id', entrada.data.fichaId).maybeSingle();
  if (!ficha || !esMiembro(ficha.academia_id, sesion.academias)) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { error } = await db.from('solicitud_modificacion').insert({
    evento_id: ficha.evento_id,
    academia_id: ficha.academia_id,
    ficha_id: ficha.id,
    descripcion: entrada.data.descripcion,
    creado_por: sesion.usuarioId,
  });
  refrescar();
  return error ? { ok: false, mensaje: codigoDe(error) } : { ok: true, mensaje: 'solicitudEnviada' };
}
