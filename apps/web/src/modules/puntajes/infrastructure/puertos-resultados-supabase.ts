import 'server-only';
import type { ReglamentoEvento } from '@soed/domain';
import { reglamentoSchema } from '@soed/shared-types';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosResultados } from '../application/resultados';

/**
 * Lee con el cliente del supervisor (RLS: `puntajes.supervisar`) y escribe la
 * tabla derivada `resultado` con la clave de servidor: nadie la edita a mano.
 */
export function puertosResultadosSupabase(db: ClienteSupabase, sesion: Sesion): PuertosResultados {
  return {
    puedeSupervisar: (eventoId) => tienePermiso(sesion, eventoId, 'puntajes.supervisar'),
    async reglamento(eventoId) {
      const { data } = await db.from('evento').select('reglamento').eq('id', eventoId).maybeSingle();
      const r = reglamentoSchema.safeParse(data?.reglamento);
      return r.success ? (r.data as ReglamentoEvento) : null;
    },
    async fichasPresentadas(eventoId) {
      const { data } = await db
        .from('ficha')
        .select('id, academia_id, categoria, formacion, genero, orden_item (estado)')
        .eq('evento_id', eventoId)
        .in('estado', ['ENVIADA', 'APROBADA']);
      return (data ?? [])
        .filter((f) => !f.orden_item.some((o) => o.estado === 'AUSENTE'))
        .map((f) => ({ id: f.id, academiaId: f.academia_id, categoria: f.categoria, formacion: f.formacion, genero: f.genero }));
    },
    async planillas(eventoId) {
      const { data } = await db.from('planilla').select('ficha_id, jurado_id, total, estado').eq('evento_id', eventoId);
      return (data ?? []).map((p) => ({
        fichaId: p.ficha_id,
        juradoId: p.jurado_id,
        total: p.total === null ? null : Number(p.total),
        estado: p.estado as 'BORRADOR' | 'ENVIADA' | 'REABIERTA',
      }));
    },
    async guardarResultados(eventoId, resultados) {
      const admin = supabaseAdmin();
      const borrado = await admin.from('resultado').delete().eq('evento_id', eventoId);
      if (borrado.error) throw new Error(borrado.error.message);
      if (resultados.length === 0) return;
      const { error } = await admin.from('resultado').insert(
        resultados.map((r) => ({
          ficha_id: r.fichaId,
          evento_id: eventoId,
          academia_id: r.academiaId,
          puntaje: r.puntaje,
          banda: r.banda,
          grupo: r.grupo,
          puesto: r.puesto,
          calculado_por: sesion.usuarioId,
        })),
      );
      if (error) throw new Error(error.message);
    },
  };
}
