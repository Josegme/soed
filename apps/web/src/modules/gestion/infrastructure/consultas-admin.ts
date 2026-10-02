import 'server-only';
import type { Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

/** Lecturas del Super Admin (RLS: es_super_admin ve todas las temporadas y eventos). */
export async function panelAdmin(db: ClienteSupabase) {
  const [{ data: temporadas }, { data: eventos }, { data: reglamentos }, { data: organizadores }] = await Promise.all([
    db.from('temporada').select('id, anio, nombre, publicada, reglamento_id').order('anio', { ascending: false }),
    db
      .from('evento')
      .select('id, temporada_id, slug, tipo, nombre, estado, publicado, fecha_inicio, fecha_fin, moneda, idioma_defecto')
      .order('fecha_inicio'),
    db.from('reglamento').select('id, nombre, preset, version').order('creado_at', { ascending: false }),
    db.from('evento_miembro').select('evento_id, usuario_id').eq('rol', 'ORGANIZADOR_EVENTO').eq('activo', true),
  ]);
  const organizadoresPorEvento = new Map<string, number>();
  for (const o of organizadores ?? []) organizadoresPorEvento.set(o.evento_id, (organizadoresPorEvento.get(o.evento_id) ?? 0) + 1);
  return {
    temporadas: (temporadas ?? []).map((t) => ({
      ...t,
      nombre: t.nombre as Traducible,
      eventos: (eventos ?? [])
        .filter((e) => e.temporada_id === t.id)
        .map((e) => ({ ...e, nombre: e.nombre as Traducible, organizadores: organizadoresPorEvento.get(e.id) ?? 0 })),
    })),
    reglamentos: (reglamentos ?? []).map((r) => ({ ...r, nombre: r.nombre as Traducible })),
    eventos: (eventos ?? []).map((e) => ({ ...e, nombre: e.nombre as Traducible })),
  };
}
