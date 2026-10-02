'use server';

import { registrarPaseSchema, uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion } from '@/lib/auth/sesion';
import { erroresDe, parsearMonto, textoDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { registrarPase } from '../application/pases';
import { puertosPaseSupabase } from '../infrastructure/puertos-pase-supabase';

/** Pases manuales a otro evento (OR-33, OR-34, TR-13): el sistema registra, no decide. */

const refrescar = () => revalidatePath('/[locale]/gestion/[eventoId]', 'layout');

function beneficioDe(datos: FormData): { valor: unknown; error?: string } {
  const tipo = textoDe(datos, 'beneficioTipo');
  if (!tipo) return { valor: null };
  if (tipo === 'BECA') return { valor: { tipo } };
  if (tipo === 'DESCUENTO_PORCENTAJE')
    return { valor: { tipo, porcentaje: Number(String(datos.get('beneficioValor') ?? '').replace(',', '.')) } };
  if (tipo === 'DESCUENTO_MONTO') {
    const monto = parsearMonto(textoDe(datos, 'beneficioValor'));
    return monto === null ? { valor: null, error: 'MONTO_INVALIDO' } : { valor: { tipo, montoCentavos: monto } };
  }
  return { valor: null, error: 'BENEFICIO_INVALIDO' };
}

export async function registrarPaseAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const beneficio = beneficioDe(datos);
  if (beneficio.error) return { ok: false, errores: { beneficioValor: beneficio.error }, valores };
  const entrada = registrarPaseSchema.safeParse({
    eventoOrigenId: datos.get('eventoOrigenId'),
    eventoDestinoId: datos.get('eventoDestinoId'),
    academiaId: datos.get('academiaId'),
    coreografiaId: textoDe(datos, 'coreografiaId'),
    motivo: datos.get('motivo'),
    beneficio: beneficio.valor,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await registrarPase(puertosPaseSupabase(db, sesion), entrada.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    refrescar();
    return { ok: true, mensaje: 'paseRegistrado' };
  }, valores);
}

const anulacionSchema = z.object({ paseId: uuidSchema, motivo: z.string().trim().min(3, 'MOTIVO_REQUERIDO').max(500) });

export async function anularPaseAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = anulacionSchema.safeParse({ paseId: datos.get('paseId'), motivo: datos.get('motivo') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error) };
  const { db } = await requerirSesion();
  const { data, error } = await db
    .from('pase')
    .update({ anulado_at: new Date().toISOString(), motivo_anulacion: entrada.data.motivo })
    .eq('id', entrada.data.paseId)
    .is('anulado_at', null)
    .select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'paseAnulado' };
}
