'use server';

import { uuidSchema, traducibleRequeridoSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, parsearMonto, textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { asignarPremio } from '../application/premios';
import { puertosPremioSupabase } from '../infrastructure/puertos-premio-supabase';

/** Configuración (OR-10) y asignación (OR-43) de premios del evento. */

const refrescar = () => revalidatePath('/[locale]/gestion/[eventoId]', 'layout');

const premioSchema = z.object({
  eventoId: uuidSchema,
  nombre: traducibleRequeridoSchema,
  tipo: z.enum(['PRINCIPAL', 'ESPECIAL']),
  criterio: z.enum(['MANUAL', 'RANKING']),
  reglaEmpate: z.enum(['DIVIDIR_MONTO', 'MONTO_COMPLETO_CADA_UNO']),
  puesto: z.int().min(1).max(50).optional(),
  grupo: z.string().max(200).optional(),
});

export async function crearPremioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const montoTexto = textoDe(datos, 'monto');
  const monto = montoTexto ? parsearMonto(montoTexto) : null;
  if (montoTexto && monto === null) return { ok: false, errores: { monto: 'MONTO_INVALIDO' }, valores };
  const entrada = premioSchema.safeParse({
    eventoId: datos.get('eventoId'),
    nombre: traducibleDe(datos, 'nombre'),
    tipo: datos.get('tipo'),
    criterio: datos.get('criterio'),
    reglaEmpate: datos.get('reglaEmpate'),
    puesto: textoDe(datos, 'puesto') ? Number(datos.get('puesto')) : undefined,
    grupo: textoDe(datos, 'grupo') ?? undefined,
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, entrada.data.eventoId, 'evento.configurar')) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const { data: evento } = await db.from('evento').select('temporada_id, moneda').eq('id', entrada.data.eventoId).single();
  if (!evento) return { ok: false, mensaje: 'EVENTO_INEXISTENTE', valores };
  const { count } = await db.from('premio').select('id', { count: 'exact', head: true }).eq('evento_id', entrada.data.eventoId);
  const e = entrada.data;
  const { error } = await db.from('premio').insert({
    temporada_id: evento.temporada_id,
    evento_id: e.eventoId,
    nombre: e.nombre as Json,
    tipo: e.tipo,
    monto_centavos: monto,
    moneda: monto === null ? null : evento.moneda,
    criterio: e.criterio,
    regla_empate: e.reglaEmpate,
    filtro: e.criterio === 'RANKING' ? { puesto: e.puesto ?? 1, ...(e.grupo ? { grupo: e.grupo } : {}) } : {},
    orden: (count ?? 0) + 1,
  });
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'premioCreado' };
}

export async function eliminarPremioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const premioId = uuidSchema.safeParse(datos.get('premioId'));
  if (!premioId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { db } = await requerirSesion();
  const { data, error } = await db.from('premio').delete().eq('id', premioId.data).select('id');
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  if (!data?.length) return { ok: false, mensaje: 'SIN_PERMISO' };
  refrescar();
  return { ok: true, mensaje: 'premioEliminado' };
}

export async function asignarPremioAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const premioId = uuidSchema.safeParse(datos.get('premioId'));
  if (!premioId.success) return { ok: false, mensaje: 'PREMIO_INEXISTENTE' };
  const fichaIds = datos
    .getAll('fichaId')
    .map(String)
    .filter((f) => uuidSchema.safeParse(f).success);
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await asignarPremio(puertosPremioSupabase(db, sesion), { premioId: premioId.data, fichaIds });
    if (!r.ok) return { ok: false, mensaje: r.error.codigo };
    refrescar();
    return { ok: true, mensaje: 'premioAsignado', valores: { asignadas: String(r.value.asignadas) } };
  });
}
