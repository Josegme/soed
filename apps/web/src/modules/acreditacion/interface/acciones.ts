'use server';

import { uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { intentar } from '@/lib/acciones';
import { requerirSesion } from '@/lib/auth/sesion';
import type { EstadoFormulario } from '@/lib/formularios';
import { emitirCredenciales } from '../application/acreditacion';
import { puertosAcreditacionSupabase } from '../infrastructure/puertos-acreditacion-supabase';

/** Emite las credenciales faltantes del evento (OR-50, OP-15). Repetible: no duplica. */
export async function emitirCredencialesAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'EVENTO_INEXISTENTE' };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await emitirCredenciales(puertosAcreditacionSupabase(db, sesion), eventoId.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    revalidatePath('/[locale]/acreditacion/[eventoId]', 'layout');
    return { ok: true, mensaje: 'credencialesEmitidas', valores: { emitidas: String(r.value.emitidas) } };
  });
}
