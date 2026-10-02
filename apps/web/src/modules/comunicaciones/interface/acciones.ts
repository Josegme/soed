'use server';

import { comunicadoSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { intentar } from '@/lib/acciones';
import { requerirSesion } from '@/lib/auth/sesion';
import { erroresDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { enviarComunicado } from '../application/comunicados';
import { puertosComunicadosSupabase } from '../infrastructure/puertos-comunicados-supabase';

/** Comunicados bilingües a academias, jurados o staff (OR-47, TR-21). */
export async function enviarComunicadoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = comunicadoSchema.safeParse({
    eventoId: datos.get('eventoId'),
    asunto: traducibleDe(datos, 'asunto'),
    cuerpo: traducibleDe(datos, 'cuerpo'),
    audiencia: datos.getAll('audiencia').map(String),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await enviarComunicado(puertosComunicadosSupabase(db, sesion), entrada.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
    return { ok: true, mensaje: 'comunicadoEnviado', valores: { enviados: String(r.value.enviados) } };
  }, valores);
}
