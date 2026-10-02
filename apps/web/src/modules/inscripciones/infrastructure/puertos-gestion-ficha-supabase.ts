import 'server-only';
import type { Infraccion } from '@soed/domain';
import type { Json } from '@soed/shared-types/database';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { FichaParaGestion, PuertosGestionFicha } from '../application/gestion-fichas';

/** El trigger de ficha permite al gestor cambiar estado, observación, bloqueo y excepción; nada más. */
export function puertosGestionFichaSupabase(db: ClienteSupabase, sesion: Sesion): PuertosGestionFicha {
  return {
    async leer(fichaId) {
      const { data } = await db.from('ficha').select('id, evento_id, estado, validacion, excepcion').eq('id', fichaId).maybeSingle();
      if (!data) return null;
      const v = data.validacion as { valida?: boolean; infracciones?: Infraccion[] } | null;
      return {
        id: data.id,
        eventoId: data.evento_id,
        estado: data.estado as FichaParaGestion['estado'],
        valida: v ? v.valida === true : null,
        tieneExcepcion: data.excepcion !== null,
        infracciones: v?.infracciones ?? [],
      };
    },
    puedeGestionar: (eventoId) => tienePermiso(sesion, eventoId, 'inscripciones.gestionar'),
    usuarioId: () => sesion.usuarioId,
    async actualizar(fichaId, cambios) {
      const { error } = await db
        .from('ficha')
        .update(cambios as { estado?: string; observacion?: string | null; bloqueada?: boolean; excepcion?: Json })
        .eq('id', fichaId);
      if (error) throw new Error(error.message);
    },
  };
}
