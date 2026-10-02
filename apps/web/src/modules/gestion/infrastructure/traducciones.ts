import 'server-only';
import { traduccionesPendientes, type Idioma, type Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

/** Dónde se edita cada contenido: ruta de la sección de gestión. */
export type SeccionContenido = 'configuracion' | 'puntajes' | 'premios' | 'orden' | 'actividades' | 'hoteles' | 'comunicados';

export interface ContenidoEvento {
  clave: string;
  seccion: SeccionContenido;
  /** Tipo de contenido (clave de mensaje) y texto de referencia para ubicarlo. */
  tipo: string;
  referencia: string;
  valor: Traducible;
}

const ref = (v: unknown) => Object.values((v ?? {}) as Traducible).find((x) => x?.trim()) ?? '';

/**
 * Todo el contenido traducible del evento (OR-18), leído con RLS del
 * organizador. Cada tabla nueva con jsonb traducible se suma aquí.
 */
export async function contenidoTraducible(db: ClienteSupabase, eventoId: string): Promise<ContenidoEvento[]> {
  const [
    { data: e },
    { data: criterios },
    { data: premios },
    { data: pistas },
    { data: bloques },
    { data: clases },
    { data: entradas },
    { data: hoteles },
    { data: comunicados },
  ] = await Promise.all([
    db.from('evento').select('nombre, bases, datos_pago, tarifario').eq('id', eventoId).single(),
    db.from('criterio').select('id, nombre').eq('evento_id', eventoId),
    db.from('premio').select('id, nombre').eq('evento_id', eventoId),
    db.from('pista').select('id, nombre').eq('evento_id', eventoId),
    db.from('bloque').select('id, nombre').eq('evento_id', eventoId),
    db.from('clase').select('id, nombre').eq('evento_id', eventoId),
    db.from('entrada_tipo').select('id, nombre').eq('evento_id', eventoId),
    db.from('hotel').select('id, nombre, descripcion').eq('evento_id', eventoId),
    db.from('comunicado').select('id, asunto, cuerpo').eq('evento_id', eventoId),
  ]);
  const items: ContenidoEvento[] = [];
  const sumar = (seccion: SeccionContenido, tipo: string, id: string, valor: unknown, referencia?: string) =>
    items.push({ clave: `${tipo}:${id}`, seccion, tipo, referencia: referencia ?? ref(valor), valor: (valor ?? {}) as Traducible });
  if (e) {
    sumar('configuracion', 'nombreEvento', 'evento', e.nombre);
    sumar('configuracion', 'bases', 'evento', e.bases, '');
    sumar('configuracion', 'datosPago', 'evento', e.datos_pago, '');
    for (const r of ((e.tarifario as { rubros?: { codigo: string; nombre: Traducible }[] }) ?? {}).rubros ?? [])
      sumar('configuracion', 'rubro', r.codigo, r.nombre);
  }
  for (const c of criterios ?? []) sumar('puntajes', 'criterio', c.id, c.nombre);
  for (const p of premios ?? []) sumar('premios', 'premio', p.id, p.nombre);
  for (const p of pistas ?? []) sumar('orden', 'pista', p.id, p.nombre);
  for (const b of bloques ?? []) sumar('orden', 'bloque', b.id, b.nombre);
  for (const c of clases ?? []) sumar('actividades', 'clase', c.id, c.nombre);
  for (const t of entradas ?? []) sumar('actividades', 'entrada', t.id, t.nombre);
  for (const h of hoteles ?? []) sumar('hoteles', 'hotel', h.id, h.descripcion, h.nombre);
  for (const c of comunicados ?? []) {
    sumar('comunicados', 'asunto', c.id, c.asunto);
    sumar('comunicados', 'cuerpo', c.id, c.cuerpo, ref(c.asunto));
  }
  return items;
}

/** Contenido con traducción pendiente en alguno de los idiomas de la instancia. */
export async function pendientesDeTraduccion(db: ClienteSupabase, eventoId: string, idiomas: readonly Idioma[]) {
  const items = await contenidoTraducible(db, eventoId);
  const porClave = new Map(items.map((i) => [i.clave, i]));
  return traduccionesPendientes(items, idiomas).map((p) => ({ ...porClave.get(p.clave)!, faltan: p.faltan }));
}
