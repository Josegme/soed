'use server';

import { codigoSchema, traducibleRequeridoSchema, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { calcularResultados } from '../application/resultados';
import { puertosResultadosSupabase } from '../infrastructure/puertos-resultados-supabase';

/** Criterios, cálculo y publicación de resultados (OR-40 a OR-45, Art. 32). */

const refrescar = () => revalidatePath('/[locale]/gestion/[eventoId]', 'layout');

const criterioSchema = z.object({
  eventoId: uuidSchema,
  codigo: codigoSchema,
  nombre: traducibleRequeridoSchema,
  peso: z.number().positive().max(100),
});

export async function guardarCriterioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = criterioSchema.safeParse({
    eventoId: datos.get('eventoId'),
    codigo: (textoDe(datos, 'codigo') ?? '').toUpperCase(),
    nombre: traducibleDe(datos, 'nombre'),
    peso: Number(String(datos.get('peso') ?? '').replace(',', '.')),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { db } = await requerirSesion();
  const { count } = await db.from('criterio').select('id', { count: 'exact', head: true }).eq('evento_id', entrada.data.eventoId);
  const { error } = await db.from('criterio').upsert(
    {
      evento_id: entrada.data.eventoId,
      codigo: entrada.data.codigo,
      nombre: entrada.data.nombre as Json,
      peso: entrada.data.peso,
      orden: (count ?? 0) + 1,
    },
    { onConflict: 'evento_id,codigo' },
  );
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'criterioGuardado' };
}

export async function eliminarCriterioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const id = uuidSchema.safeParse(datos.get('criterioId'));
  if (!id.success) return { ok: false, mensaje: 'INESPERADO' };
  const { db } = await requerirSesion();
  // Con notas cargadas la FK (on delete restrict) lo impide: no se pierden puntajes.
  const { error } = await db.from('criterio').delete().eq('id', id.data);
  if (error) return { ok: false, mensaje: error.code === '23503' ? 'CRITERIO_CON_NOTAS' : codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'criterioEliminado' };
}

export async function calcularResultadosAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'EVENTO_INEXISTENTE' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const { data: evento } = await db.from('evento').select('config_operacion').eq('id', eventoId.data).maybeSingle();
    const juradosEsperados = Number((evento?.config_operacion as { juradosPorFicha?: number } | null)?.juradosPorFicha ?? 3);
    const r = await calcularResultados(puertosResultadosSupabase(db, sesion), eventoId.data, { juradosEsperados });
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return {
      ok: true,
      mensaje: 'resultadosCalculados',
      valores: { calculados: String(r.value.resultados.length), pendientes: String(r.value.pendientes.length) },
    };
  });
}

/** Publica o despublica resultados y devoluciones (Art. 32): antes nadie fuera del equipo los ve. */
export async function publicarResultadosAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'EVENTO_INEXISTENTE' };
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, eventoId.data, 'resultados.publicar')) return { ok: false, mensaje: 'SIN_PERMISO_PUBLICAR' };
  const publicar = datos.get('publicar') === 'true';
  if (publicar) {
    const { count } = await db.from('resultado').select('ficha_id', { count: 'exact', head: true }).eq('evento_id', eventoId.data);
    if (!count) return { ok: false, mensaje: 'SIN_RESULTADOS' };
  }
  const { error } = await db
    .from('evento')
    .update({ resultados_publicados_at: publicar ? new Date().toISOString() : null })
    .eq('id', eventoId.data);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  revalidatePath('/[locale]/eventos/[slug]', 'layout');
  revalidatePath('/[locale]/academia', 'layout');
  return { ok: true, mensaje: publicar ? 'resultadosPublicados' : 'resultadosRetirados' };
}

const reaperturaSchema = z.object({ planillaId: uuidSchema, motivo: z.string().trim().min(3, 'MOTIVO_REQUERIDO').max(500) });

/** El director técnico reabre una planilla enviada con motivo (JU-07, OP-03). */
export async function reabrirPlanillaAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = reaperturaSchema.safeParse({ planillaId: datos.get('planillaId'), motivo: datos.get('motivo') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error) };
  const { db } = await requerirSesion();
  const { error } = await db
    .from('planilla')
    .update({ estado: 'REABIERTA', motivo_reapertura: entrada.data.motivo })
    .eq('id', entrada.data.planillaId);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  revalidatePath('/[locale]/vivo/[eventoId]', 'layout');
  return { ok: true, mensaje: 'planillaReabierta' };
}
