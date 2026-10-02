'use server';

import { parsearZonas, TIPOS_CREDENCIAL, type ConfigAcreditacion, type TipoCredencial } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { codigoDeError } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { instanteDesdeLocal } from '@/lib/fechas-zona';
import { textoDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';

/**
 * Zonas por tipo de credencial y horario de la mesa de acreditación (OR-15).
 * Las zonas se copian a cada credencial al emitirla; cambiarlas no reescribe
 * las ya impresas.
 */
export async function guardarAcreditacionAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const zonasPorTipo: Partial<Record<TipoCredencial, string[]>> = {};
  for (const tipo of TIPOS_CREDENCIAL) {
    const zonas = parsearZonas(textoDe(datos, `zonas.${tipo}`) ?? '');
    if (zonas.length > 12 || zonas.some((z) => z.length > 40))
      return { ok: false, errores: { [`zonas.${tipo}`]: 'ZONAS_INVALIDAS' }, valores };
    if (zonas.length > 0) zonasPorTipo[tipo] = zonas;
  }
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, eventoId.data, 'evento.configurar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { data: evento } = await db.from('evento').select('zona_horaria').eq('id', eventoId.data).maybeSingle();
  if (!evento) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const apertura = textoDe(datos, 'apertura') ? instanteDesdeLocal(textoDe(datos, 'apertura')!, evento.zona_horaria) : null;
  const cierre = textoDe(datos, 'cierre') ? instanteDesdeLocal(textoDe(datos, 'cierre')!, evento.zona_horaria) : null;
  if ((textoDe(datos, 'apertura') && !apertura) || (textoDe(datos, 'cierre') && !cierre)) {
    return { ok: false, errores: { apertura: 'FECHA_INVALIDA' }, valores };
  }
  if (apertura && cierre && cierre <= apertura) return { ok: false, errores: { cierre: 'FIN_ANTERIOR' }, valores };
  const config: ConfigAcreditacion = { zonasPorTipo, horario: { apertura, cierre } };
  const { data, error } = await db
    .from('evento')
    .update({ acreditacion: config as unknown as Json })
    .eq('id', eventoId.data)
    .select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/acreditacion/[eventoId]', 'layout');
  return { ok: true, mensaje: 'acreditacionGuardada' };
}
