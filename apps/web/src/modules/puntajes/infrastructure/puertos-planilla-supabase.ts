import 'server-only';
import type { ConfigPuntaje } from '@soed/domain';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PlanillaPropia, PuertosPlanilla } from '../application/planillas';

/**
 * Planilla del jurado con su propio cliente: RLS limita a sus planillas y el
 * trigger fija el autor, bloquea las enviadas y recalcula el total.
 */
export function puertosPlanillaSupabase(db: ClienteSupabase, sesion: Sesion): PuertosPlanilla {
  const propia = (fila: { id: string; estado: string } | null): PlanillaPropia | null =>
    fila ? { id: fila.id, estado: fila.estado as PlanillaPropia['estado'] } : null;
  return {
    puedeCargar: (eventoId) => tienePermiso(sesion, eventoId, 'puntajes.cargar'),
    async ficha(fichaId) {
      const { data } = await db.from('ficha').select('id, evento_id, academia_id').eq('id', fichaId).maybeSingle();
      return data ? { id: data.id, eventoId: data.evento_id, academiaId: data.academia_id } : null;
    },
    async configuracion(eventoId) {
      const [{ data: criterios }, { data: evento }] = await Promise.all([
        db.from('criterio').select('id, codigo, peso').eq('evento_id', eventoId).order('orden'),
        db.from('evento').select('reglamento').eq('id', eventoId).maybeSingle(),
      ]);
      const puntaje = (evento?.reglamento as { puntaje?: ConfigPuntaje } | null)?.puntaje;
      if (!puntaje) return null;
      return { criterios: (criterios ?? []).map((c) => ({ id: c.id, codigo: c.codigo, peso: Number(c.peso) })), puntaje };
    },
    async planillaPorClientUuid(clientUuid) {
      const { data } = await db
        .from('planilla')
        .select('id, estado')
        .eq('client_uuid', clientUuid)
        .eq('jurado_id', sesion.usuarioId)
        .maybeSingle();
      return propia(data);
    },
    async planillaPropia(fichaId) {
      const { data } = await db
        .from('planilla')
        .select('id, estado')
        .eq('ficha_id', fichaId)
        .eq('jurado_id', sesion.usuarioId)
        .maybeSingle();
      return propia(data);
    },
    async crear(d) {
      const { data, error } = await db
        .from('planilla')
        .insert({
          evento_id: d.eventoId,
          academia_id: d.academiaId,
          ficha_id: d.fichaId,
          jurado_id: sesion.usuarioId,
          client_uuid: d.clientUuid,
          comentario: d.comentario,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'PLANILLA_NO_CREADA');
      return data.id;
    },
    async guardarNotas(planillaId, eventoId, notas) {
      const { error } = await db.from('planilla_nota').upsert(
        notas.map((n) => ({ planilla_id: planillaId, criterio_id: n.criterioId, evento_id: eventoId, valor: n.valor })),
        { onConflict: 'planilla_id,criterio_id' },
      );
      if (error) throw new Error(error.message);
    },
    async actualizar(planillaId, c) {
      const { error } = await db
        .from('planilla')
        .update({ comentario: c.comentario, client_uuid: c.clientUuid, ...(c.enviar ? { estado: 'ENVIADA' } : {}) })
        .eq('id', planillaId);
      if (error) throw new Error(error.message);
    },
  };
}
