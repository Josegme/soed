'use server';

import { AMBITOS_CAMPO, campoAdicionalSchema, leerCamposAdicionales, uuidSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { codigoDeError } from '@/lib/acciones';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { erroresDe, textoDe, traducibleDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';

/** Campos adicionales de inscripción y ficha que define el organizador (OR-16). */

const refrescar = () => {
  revalidatePath('/[locale]/gestion/[eventoId]', 'layout');
  revalidatePath('/[locale]/academia', 'layout');
};

async function camposDelEvento(eventoId: string) {
  const { sesion, db } = await requerirSesion();
  if (!tienePermiso(sesion, eventoId, 'evento.configurar')) return null;
  const { data } = await db.from('evento').select('campos_adicionales').eq('id', eventoId).maybeSingle();
  return data ? { db, campos: leerCamposAdicionales(data.campos_adicionales) } : null;
}

export async function agregarCampoAdicionalAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const destino = z
    .object({ eventoId: uuidSchema, ambito: z.enum(AMBITOS_CAMPO) })
    .safeParse({ eventoId: datos.get('eventoId'), ambito: datos.get('ambito') });
  if (!destino.success) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const campo = campoAdicionalSchema.safeParse({
    codigo: textoDe(datos, 'codigo') ?? '',
    etiqueta: traducibleDe(datos, 'etiqueta'),
    tipo: datos.get('tipo'),
    obligatorio: datos.get('obligatorio') === 'on',
    opciones: (textoDe(datos, 'opciones') ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  });
  if (!campo.success) return { ok: false, errores: erroresDe(campo.error), valores };
  const ctx = await camposDelEvento(destino.data.eventoId);
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO', valores };
  const lista = ctx.campos[destino.data.ambito];
  if (lista.some((c) => c.codigo === campo.data.codigo)) return { ok: false, errores: { codigo: 'DUPLICADO' }, valores };
  if (lista.length >= 20) return { ok: false, mensaje: 'DEMASIADOS_CAMPOS', valores };
  const campos = { ...ctx.campos, [destino.data.ambito]: [...lista, campo.data] };
  const { error } = await ctx.db
    .from('evento')
    .update({ campos_adicionales: campos as unknown as Json })
    .eq('id', destino.data.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error), valores };
  refrescar();
  return { ok: true, mensaje: 'campoAgregado' };
}

/** Quitar un campo no borra lo ya cargado por las academias: deja de pedirse y de mostrarse. */
export async function quitarCampoAdicionalAccion(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const entrada = z
    .object({ eventoId: uuidSchema, ambito: z.enum(AMBITOS_CAMPO), codigo: z.string().min(1).max(30) })
    .safeParse({ eventoId: datos.get('eventoId'), ambito: datos.get('ambito'), codigo: datos.get('codigo') });
  if (!entrada.success) return { ok: false, mensaje: 'SIN_PERMISO' };
  const ctx = await camposDelEvento(entrada.data.eventoId);
  if (!ctx) return { ok: false, mensaje: 'SIN_PERMISO' };
  const campos = { ...ctx.campos, [entrada.data.ambito]: ctx.campos[entrada.data.ambito].filter((c) => c.codigo !== entrada.data.codigo) };
  const { error } = await ctx.db
    .from('evento')
    .update({ campos_adicionales: campos as unknown as Json })
    .eq('id', entrada.data.eventoId);
  if (error) return { ok: false, mensaje: codigoDeError(error) };
  refrescar();
  return { ok: true, mensaje: 'campoQuitado' };
}
