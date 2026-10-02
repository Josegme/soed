'use server';

import { presetReglamento } from '@soed/domain';
import { reglamentoSchema, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError } from '@/lib/acciones';
import { requerirSesion } from '@/lib/auth/sesion';
import { valoresDe, type EstadoFormulario } from '@/lib/formularios';

/**
 * Nueva versión del reglamento de la temporada (SA-07): nunca se edita una
 * versión en uso; se crea la siguiente y la temporada pasa a apuntarla. Los
 * eventos ya creados conservan su copia y su número de versión (TR-11).
 */
export async function nuevaVersionReglamentoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = z
    .object({ temporadaId: uuidSchema, origen: z.enum(['json', 'preset']) })
    .safeParse({ temporadaId: datos.get('temporadaId'), origen: datos.get('origen') });
  if (!entrada.success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { sesion, db } = await requerirSesion();
  if (!sesion.esSuperAdmin) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { data: temporada } = await db
    .from('temporada')
    .select('id, reglamento:reglamento_id (id, nombre, preset, version, config)')
    .eq('id', entrada.data.temporadaId)
    .maybeSingle();
  const actual = temporada?.reglamento;
  if (!temporada || !actual) return { ok: false, mensaje: 'REGLAMENTO_INEXISTENTE', valores };

  let crudo: unknown;
  if (entrada.data.origen === 'preset') {
    crudo = presetReglamento(actual.preset);
    if (!crudo) return { ok: false, mensaje: 'PRESET_INEXISTENTE', valores };
  } else {
    try {
      crudo = JSON.parse(String(datos.get('reglamento') ?? ''));
    } catch {
      return { ok: false, errores: { reglamento: 'JSON_INVALIDO' }, valores };
    }
  }
  const config = reglamentoSchema.safeParse(crudo);
  if (!config.success) return { ok: false, mensaje: 'REGLAMENTO_INVALIDO', valores };

  // La versión sigue la línea del preset (o del reglamento si no tiene preset).
  const linea = actual.preset
    ? await db.from('reglamento').select('version').eq('preset', actual.preset)
    : { data: [{ version: actual.version }] };
  const version = Math.max(0, ...(linea.data ?? []).map((r) => r.version)) + 1;
  const { data: nuevo, error } = await db
    .from('reglamento')
    .insert({ nombre: actual.nombre, preset: actual.preset, version, config: config.data as unknown as Json, creado_por: sesion.usuarioId })
    .select('id')
    .single();
  if (error || !nuevo) return { ok: false, mensaje: codigoDeError(error), valores };
  const { error: errorTemporada } = await db.from('temporada').update({ reglamento_id: nuevo.id }).eq('id', temporada.id);
  if (errorTemporada) return { ok: false, mensaje: codigoDeError(errorTemporada), valores };
  revalidatePath('/[locale]/admin', 'layout');
  return { ok: true, mensaje: 'reglamentoVersionado', valores: { version: String(version) } };
}
