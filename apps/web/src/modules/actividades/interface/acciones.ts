'use server';

import { esIdioma, type Idioma } from '@soed/domain';
import { traducibleRequeridoSchema, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { instanteDesdeLocal } from '@/lib/fechas-zona';
import { erroresDe, parsearMonto, textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { formatearMonto } from '@/lib/i18n/formato';
import { huellaOrigen, ipDeEncabezados, secretoOrigen } from '@/lib/origen';
import { academiaActiva } from '@/modules/academias/infrastructure/consultas';
import { notificarEmail, sinFallar } from '@/modules/notificaciones/infrastructure/encolar';
import { datosReserva, reservarClasePublica, reservarEntradaPublica } from '../infrastructure/reservas-publicas';

/** Clases y entradas (OR-51 a OR-53), reservas de academias (PR-31) y públicas (PU-09, PU-10). */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/academia', 'layout');
  revalidatePath('/[locale]/eventos/[slug]', 'layout');
};

const entero = (datos: FormData, campo: string) => (textoDe(datos, campo) === null ? Number.NaN : Number(datos.get(campo)));

const claseSchema = z.object({
  eventoId: uuidSchema,
  nombre: traducibleRequeridoSchema,
  docente: z.string().max(200).nullable(),
  sala: z.string().max(120).nullable(),
  cupo: z.int().min(0).max(10_000),
  publicada: z.boolean(),
});

async function zonaDelEvento(eventoId: string) {
  const { db } = await requerirSesion();
  const { data } = await db.from('evento').select('zona_horaria').eq('id', eventoId).maybeSingle();
  return data?.zona_horaria ?? null;
}

export async function guardarClaseAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = claseSchema.safeParse({
    eventoId: datos.get('eventoId'),
    nombre: traducibleDe(datos, 'nombre'),
    docente: textoDe(datos, 'docente'),
    sala: textoDe(datos, 'sala'),
    cupo: entero(datos, 'cupo'),
    publicada: datos.get('publicada') === 'on',
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const precio = parsearMonto(textoDe(datos, 'precio') ?? '0');
  if (precio === null) return { ok: false, errores: { precio: 'MONTO_INVALIDO' }, valores };
  const claseId = textoDe(datos, 'claseId');
  if (claseId && !uuidSchema.safeParse(claseId).success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  const e = entrada.data;
  if (!tienePermiso(sesion, e.eventoId, 'evento.configurar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const zona = (await zonaDelEvento(e.eventoId)) ?? 'UTC';
  const inicio = instanteDesdeLocal(textoDe(datos, 'inicio') ?? '', zona);
  const fin = instanteDesdeLocal(textoDe(datos, 'fin') ?? '', zona);
  if (!inicio) return { ok: false, errores: { inicio: 'FECHA_INVALIDA' }, valores };
  if (!fin || fin <= inicio) return { ok: false, errores: { fin: 'FIN_ANTERIOR' }, valores };
  const fila = {
    evento_id: e.eventoId,
    nombre: e.nombre as Json,
    docente: e.docente,
    sala: e.sala,
    inicio,
    fin,
    cupo: e.cupo,
    precio_centavos: precio,
    publicada: e.publicada,
  };
  const { data, error } = claseId
    ? await db.from('clase').update(fila).eq('id', claseId).eq('evento_id', e.eventoId).select('id')
    : await db.from('clase').insert(fila).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  refrescar();
  return { ok: true, mensaje: claseId ? 'claseActualizada' : 'claseCreada' };
}

const entradaSchema = z.object({
  eventoId: uuidSchema,
  nombre: traducibleRequeridoSchema,
  fecha: z.iso.date().nullable(),
  cupo: z.int().min(0).max(100_000),
  publicada: z.boolean(),
});

export async function guardarEntradaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = entradaSchema.safeParse({
    eventoId: datos.get('eventoId'),
    nombre: traducibleDe(datos, 'nombre'),
    fecha: textoDe(datos, 'fecha'),
    cupo: entero(datos, 'cupo'),
    publicada: datos.get('publicada') === 'on',
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const precio = parsearMonto(textoDe(datos, 'precio') ?? '0');
  if (precio === null) return { ok: false, errores: { precio: 'MONTO_INVALIDO' }, valores };
  const tipoId = textoDe(datos, 'entradaId');
  if (tipoId && !uuidSchema.safeParse(tipoId).success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  const e = entrada.data;
  if (!tienePermiso(sesion, e.eventoId, 'evento.configurar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const fila = {
    evento_id: e.eventoId,
    nombre: e.nombre as Json,
    fecha: e.fecha,
    cupo: e.cupo,
    precio_centavos: precio,
    publicada: e.publicada,
  };
  const { data, error } = tipoId
    ? await db.from('entrada_tipo').update(fila).eq('id', tipoId).eq('evento_id', e.eventoId).select('id')
    : await db.from('entrada_tipo').insert(fila).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  refrescar();
  return { ok: true, mensaje: tipoId ? 'entradaActualizada' : 'entradaCreada' };
}

const reservaSchema = z.object({ tipo: z.enum(['clase', 'entrada']), reservaId: uuidSchema });

/** Cobro manual registrado por caja u organización (OR-53): marca pagada y confirmada, con autor y hora. */
export async function cobrarReservaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const r = reservaSchema.safeParse({ tipo: datos.get('tipo'), reservaId: datos.get('reservaId') });
  if (!r.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { sesion, db } = await requerirSesion();
  const cambios = { pagada: true, estado: 'CONFIRMADA', cobrado_por: sesion.usuarioId, cobrado_at: new Date().toISOString() };
  const { data, error } =
    r.data.tipo === 'clase'
      ? await db.from('reserva_clase').update(cambios).eq('id', r.data.reservaId).eq('pagada', false).select('id')
      : await db.from('reserva_entrada').update(cambios).eq('id', r.data.reservaId).eq('pagada', false).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'reservaCobrada' };
}

export async function cancelarReservaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const r = reservaSchema.safeParse({ tipo: datos.get('tipo'), reservaId: datos.get('reservaId') });
  if (!r.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { db } = await requerirSesion();
  const { data, error } =
    r.data.tipo === 'clase'
      ? await db.from('reserva_clase').update({ estado: 'CANCELADA' }).eq('id', r.data.reservaId).select('id')
      : await db.from('reserva_entrada').update({ estado: 'CANCELADA' }).eq('id', r.data.reservaId).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'reservaCancelada' };
}

/** La academia reserva una clase para uno de sus bailarines (PR-31); el cupo lo verifica la base. */
export async function reservarClaseAcademiaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = z
    .object({ claseId: uuidSchema, eventoId: uuidSchema, nombre: z.string().trim().min(2).max(200) })
    .safeParse({ claseId: datos.get('claseId'), eventoId: datos.get('eventoId'), nombre: textoDe(datos, 'nombre') ?? '' });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { sesion, db } = await requerirSesion();
  const academia = academiaActiva(sesion);
  if (!academia) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { error } = await db.from('reserva_clase').insert({
    clase_id: entrada.data.claseId,
    evento_id: entrada.data.eventoId,
    academia_id: academia.id,
    nombre: entrada.data.nombre,
  });
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'claseReservada' };
}

const publicaSchema = z.object({
  tipo: z.enum(['clase', 'entrada']),
  id: uuidSchema,
  nombre: z.string().trim().min(2).max(200),
  email: z.email().max(320),
  cantidad: z.int().min(1).max(20),
});

/**
 * Reserva pública sin cuenta (PU-09, PU-10). Anti-spam: campo trampa oculto y
 * límite de frecuencia por origen (HMAC de la IP) y por email en la base.
 * El pago es manual en el evento: la reserva no cobra nada.
 */
export async function reservarPublicaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  // Un bot que completa el campo oculto recibe la misma respuesta que un humano, sin efectos.
  if (textoDe(datos, 'sitio_web')) return { ok: true, mensaje: 'reservaRecibida', valores: { codigo: '—' } };
  const entrada = publicaSchema.safeParse({
    tipo: datos.get('tipo'),
    id: datos.get('id'),
    nombre: textoDe(datos, 'nombre') ?? '',
    email: textoDe(datos, 'email') ?? '',
    cantidad: datos.get('tipo') === 'clase' ? 1 : entero(datos, 'cantidad'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const e = entrada.data;
  const origen = huellaOrigen(ipDeEncabezados(await headers()), secretoOrigen());
  const locale = await getLocale();
  const idioma: Idioma = esIdioma(locale) ? locale : 'es';
  return intentar(async () => {
    const reserva =
      e.tipo === 'entrada'
        ? await reservarEntradaPublica({ entradaTipoId: e.id, nombre: e.nombre, email: e.email, cantidad: e.cantidad, origen })
        : { ...(await reservarClasePublica({ claseId: e.id, nombre: e.nombre, email: e.email, origen })), codigo: null };
    const codigo = reserva.codigo ?? reserva.id.slice(0, 8).toUpperCase();
    await sinFallar(async () => {
      const d = await datosReserva(e.tipo, e.id);
      if (!d?.evento) return;
      const ev = d.evento;
      await notificarEmail({
        email: e.email,
        idioma,
        tipo: 'reserva_recibida',
        datos: {
          evento: ev.nombre as Record<string, string>,
          detalle: d.nombre as Record<string, string>,
          codigo,
          cantidad: String(e.cantidad),
          total: (i) => formatearMonto(Number(d.precio_centavos) * e.cantidad, ev.moneda, i),
        },
        ruta: `/eventos/${ev.slug.toLowerCase()}`,
      });
    });
    refrescar();
    return { ok: true, mensaje: 'reservaRecibida', valores: { codigo } };
  }, valores);
}
