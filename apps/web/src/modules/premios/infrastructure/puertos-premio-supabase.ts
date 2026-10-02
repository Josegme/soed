import 'server-only';
import type { CriterioAsignacion, Moneda, ReglaEmpate } from '@soed/domain';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosPremio } from '../application/premios';

/** Premios con RLS: asignar exige `premios.asignar`; el ranking se lee de `resultado` (puntajes.supervisar o pases.registrar). */
export function puertosPremioSupabase(db: ClienteSupabase, sesion: Sesion): PuertosPremio {
  return {
    async premio(id) {
      const { data } = await db
        .from('premio')
        .select('id, evento_id, monto_centavos, moneda, criterio, regla_empate, filtro')
        .eq('id', id)
        .maybeSingle();
      return data
        ? {
            id: data.id,
            eventoId: data.evento_id,
            montoCentavos: data.monto_centavos === null ? null : Number(data.monto_centavos),
            moneda: data.moneda as Moneda | null,
            criterio: data.criterio as CriterioAsignacion,
            reglaEmpate: data.regla_empate as ReglaEmpate,
            filtro: (data.filtro ?? {}) as { puesto?: number; grupo?: string },
          }
        : null;
    },
    puedeAsignar: (eventoId) => tienePermiso(sesion, eventoId, 'premios.asignar'),
    async ranking(eventoId) {
      const { data } = await db.from('resultado').select('ficha_id, grupo, puesto').eq('evento_id', eventoId);
      return (data ?? []).map((r) => ({ fichaId: r.ficha_id, grupo: r.grupo, puesto: r.puesto }));
    },
    async fichas(eventoId, ids) {
      const { data } = await db
        .from('ficha')
        .select('id, academia_id')
        .eq('evento_id', eventoId)
        .in('id', [...ids]);
      return (data ?? []).map((f) => ({ id: f.id, academiaId: f.academia_id }));
    },
    async reemplazarAsignaciones(premioId, eventoId, asignaciones) {
      const borrado = await db.from('premio_asignacion').delete().eq('premio_id', premioId);
      if (borrado.error) throw new Error(borrado.error.message);
      const { error } = await db.from('premio_asignacion').insert(
        asignaciones.map((a) => ({
          premio_id: premioId,
          evento_id: eventoId,
          academia_id: a.academiaId,
          ficha_id: a.fichaId,
          monto_centavos: a.montoCentavos,
          asignado_por: sesion.usuarioId,
        })),
      );
      if (error) throw new Error(error.message);
    },
  };
}
