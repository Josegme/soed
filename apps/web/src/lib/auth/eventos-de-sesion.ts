import 'server-only';
import type { Traducible } from '@soed/domain';
import { cache } from 'react';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { Sesion } from './sesion';

export interface EventoDeSesion {
  id: string;
  slug: string;
  tipo: string;
  nombre: Traducible;
  idiomaDefecto: string;
  fechaInicio: string;
}

/** Eventos donde el usuario tiene algún rol (todos para Super Admin), ordenados por fecha. */
export const eventosDeSesion = cache(async (db: ClienteSupabase, sesion: Sesion): Promise<EventoDeSesion[]> => {
  const ids = [...sesion.permisos.keys()];
  if (!sesion.esSuperAdmin && ids.length === 0) return [];
  let consulta = db.from('evento').select('id, slug, tipo, nombre, idioma_defecto, fecha_inicio').order('fecha_inicio');
  if (!sesion.esSuperAdmin) consulta = consulta.in('id', ids);
  const { data } = await consulta;
  return (data ?? []).map((e) => ({
    id: e.id,
    slug: e.slug,
    tipo: e.tipo,
    nombre: e.nombre as Traducible,
    idiomaDefecto: e.idioma_defecto,
    fechaInicio: e.fecha_inicio,
  }));
});
