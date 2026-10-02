import 'server-only';
import type { Json } from '@soed/shared-types/database';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosPase } from '../application/pases';

export function puertosPaseSupabase(db: ClienteSupabase, sesion: Sesion): PuertosPase {
  return {
    puedeRegistrar: (eventoId) => tienePermiso(sesion, eventoId, 'pases.registrar'),
    async destinoValido(origenId, destinoId) {
      // RPC acotada: la final suele no estar publicada ni tener al organizador como miembro.
      const { data } = await db.rpc('eventos_destino_pase', { p_origen: origenId });
      return (data ?? []).some((e) => e.id === destinoId);
    },
    async coreografiaDeAcademia(coreografiaId, academiaId) {
      const { data } = await db.from('coreografia').select('id').eq('id', coreografiaId).eq('academia_id', academiaId).maybeSingle();
      return !!data;
    },
    async insertar(p) {
      const { data, error } = await db
        .from('pase')
        .insert({
          evento_origen_id: p.eventoOrigenId,
          evento_destino_id: p.eventoDestinoId,
          academia_id: p.academiaId,
          coreografia_id: p.coreografiaId,
          motivo: p.motivo,
          beneficio: p.beneficio as unknown as Json,
          registrado_por: sesion.usuarioId,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'PASE_NO_REGISTRADO');
      return data.id;
    },
  };
}
