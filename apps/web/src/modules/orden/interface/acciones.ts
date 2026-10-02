'use server';

import { cambiarEstadoOrdenSchema, reordenarSchema, traducibleRequeridoSchema, uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { instanteDesdeLocal } from '@/lib/fechas-zona';
import { textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import type { Json } from '@soed/shared-types/database';
import { asignarFichasABloque, avanzarOrden, cambiarEstadoOrden } from '../application/orden';
import { puertosOrdenSupabase } from '../infrastructure/puertos-orden-supabase';
import { alPublicar } from '@/modules/notificaciones/infrastructure/efectos';

/** Construcción del orden de salida (OR-35 a OR-39) y operación en vivo (OP-05 a OP-08). */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/vivo/[eventoId]', 'layout');
  // Cronograma y orden públicos (PU-06, PU-07) dependen de pistas, bloques e ítems.
  revalidatePath('/[locale]/eventos/[slug]', 'layout');
};

const nombreDe = (datos: FormData) => traducibleRequeridoSchema.safeParse(traducibleDe(datos, 'nombre'));

export async function crearPistaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  const nombre = nombreDe(datos);
  if (!eventoId.success || !nombre.success) return { ok: false, errores: { nombre: 'TRADUCCION_REQUERIDA' }, valores };
  const { db } = await requerirSesion();
  const { count } = await db.from('pista').select('id', { count: 'exact', head: true }).eq('evento_id', eventoId.data);
  const { error } = await db.from('pista').insert({ evento_id: eventoId.data, nombre: nombre.data as Json, orden: (count ?? 0) + 1 });
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'pistaCreada' };
}

export async function crearBloqueAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const pistaId = uuidSchema.safeParse(datos.get('pistaId'));
  const nombre = nombreDe(datos);
  if (!pistaId.success || !nombre.success) return { ok: false, errores: { nombre: 'TRADUCCION_REQUERIDA' }, valores };
  const { db } = await requerirSesion();
  const { data: pista } = await db.from('pista').select('evento_id, evento:evento_id (zona_horaria)').eq('id', pistaId.data).maybeSingle();
  if (!pista) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const local = textoDe(datos, 'inicio');
  const inicio = local ? instanteDesdeLocal(local, pista.evento?.zona_horaria ?? 'UTC') : null;
  if (local && !inicio) return { ok: false, errores: { inicio: 'FECHA_INVALIDA' }, valores };
  const { count } = await db.from('bloque').select('id', { count: 'exact', head: true }).eq('pista_id', pistaId.data);
  const { error } = await db.from('bloque').insert({
    evento_id: pista.evento_id,
    pista_id: pistaId.data,
    nombre: nombre.data as Json,
    inicio_programado: inicio,
    orden: (count ?? 0) + 1,
  });
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'bloqueCreado' };
}

export async function asignarFichasAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const bloqueId = uuidSchema.safeParse(datos.get('bloqueId'));
  if (!bloqueId.success) return { ok: false, mensaje: 'BLOQUE_INEXISTENTE' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await asignarFichasABloque(puertosOrdenSupabase(db, sesion), bloqueId.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return { ok: true, mensaje: 'fichasAsignadas' };
  });
}

/** Mueve una coreografía a una posición (y bloque) con la RPC transaccional: renumera sin huecos. */
export async function moverItemAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = reordenarSchema.safeParse({
    itemId: datos.get('itemId'),
    bloqueId: datos.get('bloqueId'),
    posicion: Number(datos.get('posicion')),
  });
  if (!entrada.success) return { ok: false, mensaje: 'POSICION_INVALIDA' };
  const { db } = await requerirSesion();
  const { error } = await db.rpc('reordenar_orden', {
    p_item: entrada.data.itemId,
    p_bloque_destino: entrada.data.bloqueId,
    p_posicion: entrada.data.posicion,
  });
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'ordenActualizado' };
}

export async function quitarItemAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const itemId = uuidSchema.safeParse(datos.get('itemId'));
  if (!itemId.success) return { ok: false, mensaje: 'ITEM_INEXISTENTE' };
  const { db } = await requerirSesion();
  const { data, error } = await db.from('orden_item').delete().eq('id', itemId.data).eq('estado', 'PROGRAMADA').select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'ITEM_NO_QUITABLE' };
  refrescar();
  return { ok: true, mensaje: 'ordenActualizado' };
}

export async function cambiarEstadoOrdenAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = cambiarEstadoOrdenSchema.safeParse({ itemId: datos.get('itemId'), estado: datos.get('estado') });
  if (!entrada.success) return { ok: false, mensaje: 'TRANSICION_INVALIDA' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await cambiarEstadoOrden(puertosOrdenSupabase(db, sesion), entrada.data.itemId, entrada.data.estado);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return { ok: true };
  });
}

/** Publica o retira el orden del sitio público (OR-39). Requiere `resultados.publicar` (trigger). */
export async function publicarOrdenAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'EVENTO_INEXISTENTE' };
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, eventoId.data, 'resultados.publicar')) return { ok: false, mensaje: 'SIN_PERMISO_PUBLICAR' };
  const publicar = datos.get('publicar') === 'true';
  const { error } = await db
    .from('evento')
    .update({ orden_publicado_at: publicar ? new Date().toISOString() : null })
    .eq('id', eventoId.data);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  revalidatePath('/[locale]/eventos/[slug]', 'layout');
  if (publicar) await alPublicar(eventoId.data, 'orden_publicado');
  return { ok: true, mensaje: publicar ? 'ordenPublicado' : 'ordenRetirado' };
}

/** "Siguiente" del coordinador en una pista (OP-05, OP-06). */
export async function avanzarOrdenAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const pistaId = uuidSchema.safeParse(datos.get('pistaId'));
  if (!pistaId.success) return { ok: false, mensaje: 'ITEM_INEXISTENTE' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await avanzarOrden(puertosOrdenSupabase(db, sesion), pistaId.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return { ok: true };
  });
}
