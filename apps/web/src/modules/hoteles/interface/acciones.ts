'use server';

import { traducibleSchema, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, parsearMonto, textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';

/** Hoteles y paquetes (OR-09) y solicitudes de las academias (PR-30). */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/academia', 'layout');
};

const hotelSchema = z.object({
  eventoId: uuidSchema,
  nombre: z.string().trim().min(2).max(200),
  descripcion: traducibleSchema,
  cupo: z.int().min(0).max(10_000),
  criterio: z.enum(['PRIMER_PAGO', 'INSCRIPCION']),
});

const numero = (datos: FormData, campo: string) => (textoDe(datos, campo) === null ? Number.NaN : Number(datos.get(campo)));

export async function guardarHotelAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const precioTexto = textoDe(datos, 'precio');
  const precio = precioTexto ? parsearMonto(precioTexto) : null;
  if (precioTexto && precio === null) return { ok: false, errores: { precio: 'MONTO_INVALIDO' }, valores };
  const entrada = hotelSchema.safeParse({
    eventoId: datos.get('eventoId'),
    nombre: textoDe(datos, 'nombre') ?? '',
    descripcion: traducibleDe(datos, 'descripcion'),
    cupo: numero(datos, 'cupo'),
    criterio: datos.get('criterio'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const hotelId = textoDe(datos, 'hotelId');
  if (hotelId && !uuidSchema.safeParse(hotelId).success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  const e = entrada.data;
  if (!tienePermiso(sesion, e.eventoId, 'evento.configurar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const fila = {
    evento_id: e.eventoId,
    nombre: e.nombre,
    descripcion: e.descripcion as Json,
    cupo: e.cupo,
    precio_centavos: precio,
    criterio_asignacion: e.criterio,
  };
  const { data, error } = hotelId
    ? await db.from('hotel').update(fila).eq('id', hotelId).eq('evento_id', e.eventoId).select('id')
    : await db.from('hotel').insert(fila).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  refrescar();
  return { ok: true, mensaje: hotelId ? 'hotelActualizado' : 'hotelCreado' };
}

export async function eliminarHotelAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const hotelId = uuidSchema.safeParse(datos.get('hotelId'));
  if (!hotelId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { db } = await requerirSesion();
  const { count } = await db.from('hotel_solicitud').select('id', { count: 'exact', head: true }).eq('hotel_id', hotelId.data);
  if ((count ?? 0) > 0) return { ok: false, mensaje: 'HOTEL_CON_SOLICITUDES' };
  const { data, error } = await db.from('hotel').delete().eq('id', hotelId.data).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'hotelEliminado' };
}

const solicitudSchema = z.object({
  hotelId: uuidSchema,
  inscripcionId: uuidSchema,
  plazas: z.int().min(1).max(200),
});

/**
 * Alta o cambio de la solicitud de la academia. La RLS exige que la academia
 * sea del usuario; las FK compuestas, que hotel e inscripción sean del mismo evento.
 */
export async function solicitarHotelAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = solicitudSchema.safeParse({
    hotelId: datos.get('hotelId'),
    inscripcionId: datos.get('inscripcionId'),
    plazas: numero(datos, 'plazas'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { db } = await requerirSesion();
  const { data: inscripcion } = await db
    .from('inscripcion')
    .select('id, evento_id, academia_id')
    .eq('id', entrada.data.inscripcionId)
    .maybeSingle();
  if (!inscripcion) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { error } = await db.from('hotel_solicitud').upsert(
    {
      hotel_id: entrada.data.hotelId,
      evento_id: inscripcion.evento_id,
      academia_id: inscripcion.academia_id,
      inscripcion_id: inscripcion.id,
      plazas: entrada.data.plazas,
    },
    { onConflict: 'hotel_id,inscripcion_id' },
  );
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'solicitudHotelGuardada' };
}

export async function cancelarSolicitudHotelAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const solicitudId = uuidSchema.safeParse(datos.get('solicitudId'));
  if (!solicitudId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { db } = await requerirSesion();
  const { data, error } = await db.from('hotel_solicitud').delete().eq('id', solicitudId.data).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'solicitudHotelCancelada' };
}
