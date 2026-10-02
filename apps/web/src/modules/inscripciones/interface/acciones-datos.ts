'use server';

import { validarCamposAdicionales } from '@soed/domain';
import { leerCamposAdicionales, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError } from '@/lib/acciones';
import { valoresCamposAdicionales } from '@/lib/campos-adicionales';
import { requerirSesion } from '@/lib/auth/sesion';
import { valoresDe, type EstadoFormulario } from '@/lib/formularios';

/**
 * La academia completa los campos adicionales de su inscripción o de una
 * ficha (PR-18). El dominio valida tipos, opciones y obligatorios; la RLS,
 * que la fila sea de la academia.
 */
export async function guardarDatosAdicionalesAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valoresForm = valoresDe(datos);
  const entrada = z
    .object({ ambito: z.enum(['inscripcion', 'ficha']), id: uuidSchema })
    .safeParse({ ambito: datos.get('ambito'), id: datos.get('id') });
  if (!entrada.success) return { ok: false, mensaje: 'SIN_PERMISO', valores: valoresForm };
  const { ambito, id } = entrada.data;
  const { db } = await requerirSesion();
  const { data: fila } =
    ambito === 'inscripcion'
      ? await db.from('inscripcion').select('evento_id').eq('id', id).maybeSingle()
      : await db.from('ficha').select('evento_id').eq('id', id).maybeSingle();
  if (!fila) return { ok: false, mensaje: 'SIN_PERMISO', valores: valoresForm };
  const { data: evento } = await db.from('evento').select('campos_adicionales').eq('id', fila.evento_id).maybeSingle();
  const definiciones = leerCamposAdicionales(evento?.campos_adicionales)[ambito];
  const valores = valoresCamposAdicionales(definiciones, datos);
  const errores = validarCamposAdicionales(definiciones, valores);
  if (errores.length > 0) {
    return {
      ok: false,
      errores: Object.fromEntries(errores.map((e) => [`dato.${e.params?.campo ?? ''}`, e.codigo])),
      valores: valoresForm,
    };
  }
  const { data, error } =
    ambito === 'inscripcion'
      ? await db
          .from('inscripcion')
          .update({ datos_adicionales: valores as Json })
          .eq('id', id)
          .select('id')
      : await db
          .from('ficha')
          .update({ datos_adicionales: valores as Json })
          .eq('id', id)
          .select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error), valores: valoresForm };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO', valores: valoresForm };
  revalidatePath('/[locale]/academia', 'layout');
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  return { ok: true, mensaje: 'datosAdicionalesGuardados' };
}
