'use server';

import type { Idioma } from '@soed/domain';
import { ajusteSchema, uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, parsearMonto, textoDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { idiomaDe } from '@/lib/i18n/locales';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { alEmitirLiquidacion } from '@/modules/notificaciones/infrastructure/efectos';
import type { Sesion } from '@/lib/auth/permisos';
import { emitirLiquidacion } from '../application/liquidaciones';
import { puertosLiquidacionSupabase } from '../infrastructure/puertos-liquidacion-supabase';

/**
 * Ajustes del organizador sobre una liquidación (OR-25): sin cargo, monto
 * libre o descuentos, siempre con motivo. Cada cambio emite una nueva versión
 * (la anterior queda en el historial, TR-18).
 */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/academia', 'layout');
};

async function reemitir(db: ClienteSupabase, sesion: Sesion, inscripcionId: string) {
  const idioma: Idioma = idiomaDe(await getLocale());
  const r = await emitirLiquidacion(puertosLiquidacionSupabase(db, sesion), inscripcionId, idioma);
  if (r.ok && r.value.nueva) await alEmitirLiquidacion(inscripcionId, r.value.numero, r.value.totalCentavos);
  return r;
}

export async function registrarAjusteAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const inscripcionId = uuidSchema.safeParse(datos.get('inscripcionId'));
  if (!inscripcionId.success) return { ok: false, errores: { inscripcionId: 'REQUERIDO' }, valores };
  const tipo = String(datos.get('tipo') ?? '');
  const valor = textoDe(datos, 'valor');
  const crudo =
    tipo === 'DESCUENTO_PORCENTAJE'
      ? { tipo, porcentaje: Number((valor ?? '').replace(',', '.')), motivo: datos.get('motivo') }
      : tipo === 'MONTO_LIBRE' || tipo === 'DESCUENTO_MONTO'
        ? { tipo, monto: parsearMonto(valor) ?? -1, motivo: datos.get('motivo') }
        : { tipo, motivo: datos.get('motivo') };
  const entrada = ajusteSchema.safeParse(crudo);
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const { data: i } = await db.from('inscripcion').select('evento_id, academia_id').eq('id', inscripcionId.data).maybeSingle();
    if (!i || !tienePermiso(sesion, i.evento_id, 'inscripciones.gestionar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
    const a = entrada.data;
    const { error } = await db.from('ajuste_liquidacion').insert({
      evento_id: i.evento_id,
      academia_id: i.academia_id,
      inscripcion_id: inscripcionId.data,
      tipo: a.tipo,
      monto_centavos: 'monto' in a ? a.monto : null,
      porcentaje: 'porcentaje' in a ? a.porcentaje : null,
      motivo: a.motivo,
      creado_por: sesion.usuarioId,
    });
    if (error) return { ok: false, mensaje: codigoDeError(error), valores };
    const r = await reemitir(db, sesion, inscripcionId.data);
    refrescar();
    return {
      ok: true,
      mensaje: r.ok ? 'ajusteRegistrado' : 'ajusteSinLiquidacion',
      valores: r.ok ? { numero: r.value.numero, version: String(r.value.version) } : undefined,
    };
  }, valores);
}

export async function anularAjusteAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const ajusteId = uuidSchema.safeParse(datos.get('ajusteId'));
  if (!ajusteId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const { data, error } = await db
      .from('ajuste_liquidacion')
      .update({ anulado_at: new Date().toISOString() })
      .eq('id', ajusteId.data)
      .is('anulado_at', null)
      .select('inscripcion_id')
      .maybeSingle();
    if (error) return { ok: false, mensaje: codigoDeError(error) };
    if (!data) return { ok: false, mensaje: 'SIN_PERMISO' };
    await reemitir(db, sesion, data.inscripcion_id);
    refrescar();
    return { ok: true, mensaje: 'ajusteAnulado' };
  });
}

/** El organizador emite o actualiza la liquidación de una academia (OR-26). */
export async function emitirLiquidacionGestionAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const inscripcionId = uuidSchema.safeParse(datos.get('inscripcionId'));
  if (!inscripcionId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await reemitir(db, sesion, inscripcionId.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return {
      ok: true,
      mensaje: r.value.nueva ? 'liquidacionEmitida' : 'liquidacionSinCambios',
      valores: { numero: r.value.numero, version: String(r.value.version) },
    };
  });
}
