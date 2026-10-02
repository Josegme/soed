'use server';

import { gestionFichaSchema, uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, textoDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { gestionarFicha } from '../application/gestion-fichas';
import { puertosGestionFichaSupabase } from '../infrastructure/puertos-gestion-ficha-supabase';

/** Acciones del organizador sobre fichas y solicitudes de modificación (OR-21 a OR-25). */

const refrescar = () => revalidatePath('/[locale]/gestion/[eventoId]', 'layout');

export async function gestionarFichaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = gestionFichaSchema.safeParse({
    accion: datos.get('accion'),
    fichaId: datos.get('fichaId'),
    observacion: textoDe(datos, 'observacion') ?? undefined,
    motivo: textoDe(datos, 'motivo') ?? undefined,
    bloqueada: datos.get('bloqueada') === 'true',
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await gestionarFicha(puertosGestionFichaSupabase(db, sesion), entrada.data, new Date());
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    refrescar();
    return { ok: true, mensaje: `ficha${entrada.data.accion}` };
  }, valores);
}

const resolucionSchema = z.object({
  solicitudId: uuidSchema,
  estado: z.enum(['APROBADA', 'RECHAZADA']),
  respuesta: z.string().trim().max(4000).optional(),
});

export async function resolverSolicitudAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = resolucionSchema.safeParse({
    solicitudId: datos.get('solicitudId'),
    estado: datos.get('estado'),
    respuesta: textoDe(datos, 'respuesta') ?? undefined,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error) };
  const { sesion, db } = await requerirSesion();
  const { data: s } = await db.from('solicitud_modificacion').select('evento_id').eq('id', entrada.data.solicitudId).maybeSingle();
  if (!s || !tienePermiso(sesion, s.evento_id, 'inscripciones.gestionar')) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { error } = await db
    .from('solicitud_modificacion')
    .update({
      estado: entrada.data.estado,
      respuesta: entrada.data.respuesta ?? null,
      resuelto_por: sesion.usuarioId,
      resuelto_at: new Date().toISOString(),
    })
    .eq('id', entrada.data.solicitudId);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'solicitudResuelta' };
}
