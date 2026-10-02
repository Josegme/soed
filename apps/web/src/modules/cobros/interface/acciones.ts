'use server';

import { anularCobroSchema, monedaSchema, registrarCobroSchema, uuidSchema } from '@soed/shared-types';
import { revalidatePath } from 'next/cache';
import { codigoDeError, intentar } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, parsearMonto, textoDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { anularCobro, registrarCobro } from '../application/cobros';
import { puertosCobroSupabase } from '../infrastructure/puertos-cobro-supabase';
import { alRegistrarCobro } from '@/modules/notificaciones/infrastructure/efectos';

/** Cobros manuales en el panel o en la mesa (OR-28, OR-30, OR-31, OP-20). Nunca hay pasarela de pago. */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/acreditacion/[eventoId]', 'layout');
};

export async function registrarCobroAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const monto = parsearMonto(textoDe(datos, 'monto'));
  if (monto === null || monto <= 0) return { ok: false, errores: { monto: 'MONTO_INVALIDO' }, valores };
  const entrada = registrarCobroSchema.safeParse({
    liquidacionId: datos.get('liquidacionId'),
    montoCentavos: monto,
    moneda: monedaSchema.safeParse(datos.get('moneda')).data,
    medio: datos.get('medio'),
    referencia: textoDe(datos, 'referencia') ?? undefined,
    nota: textoDe(datos, 'nota') ?? undefined,
    clientUuid: datos.get('clientUuid'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await registrarCobro(puertosCobroSupabase(db, sesion), entrada.data);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    refrescar();
    if (!r.value.duplicado) await alRegistrarCobro(entrada.data.liquidacionId, entrada.data.montoCentavos, r.value.saldoCentavos);
    return { ok: true, mensaje: r.value.duplicado ? 'cobroDuplicado' : 'cobroRegistrado' };
  }, valores);
}

export async function anularCobroAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = anularCobroSchema.safeParse({ cobroId: datos.get('cobroId'), motivo: datos.get('motivo') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  return intentar(async () => {
    const { sesion, db } = await requerirSesion();
    const r = await anularCobro(puertosCobroSupabase(db, sesion), entrada.data.cobroId, entrada.data.motivo);
    if (!r.ok) return { ok: false, mensaje: r.error.codigo, valores };
    refrescar();
    return { ok: true, mensaje: 'cobroAnulado' };
  }, valores);
}

export async function abrirTurnoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const eventoId = uuidSchema.safeParse(datos.get('eventoId'));
  if (!eventoId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, eventoId.data, 'cobros.registrar')) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { error } = await db.from('turno_caja').insert({ evento_id: eventoId.data, usuario_id: sesion.usuarioId });
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'turnoAbierto' };
}

/** Cierra un turno guardando el resumen por medio y persona del momento del cierre. */
export async function cerrarTurnoAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const turnoId = uuidSchema.safeParse(datos.get('turnoId'));
  if (!turnoId.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const { sesion, db } = await requerirSesion();
  const { data: turno } = await db.from('turno_caja').select('id, evento_id, cerrado_at').eq('id', turnoId.data).maybeSingle();
  if (!turno || !tienePermiso(sesion, turno.evento_id, 'caja.cerrar')) return { ok: false, mensaje: 'SIN_PERMISO' };
  if (turno.cerrado_at) return { ok: false, mensaje: 'TURNO_CERRADO' };
  const { data: cobros } = await db.from('cobro').select('monto_centavos, medio, anulado_at').eq('turno_caja_id', turno.id);
  const porMedio: Record<string, number> = {};
  let total = 0;
  for (const c of cobros ?? []) {
    if (c.anulado_at) continue;
    porMedio[c.medio] = (porMedio[c.medio] ?? 0) + Number(c.monto_centavos);
    total += Number(c.monto_centavos);
  }
  const { error } = await db
    .from('turno_caja')
    .update({
      cerrado_at: new Date().toISOString(),
      cerrado_por: sesion.usuarioId,
      resumen: { porMedio, total, cobros: cobros?.length ?? 0 },
    })
    .eq('id', turno.id);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'turnoCerrado' };
}
