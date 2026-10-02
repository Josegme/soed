import 'server-only';
import type { Moneda } from '@soed/domain';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosCobro } from '../application/cobros';

/**
 * Cobros con el cliente del usuario: RLS exige `cobros.registrar`/`cobros.anular`
 * y el trigger fija autor, valida moneda y medio, y bloquea cualquier edición
 * que no sea la anulación (ADR-0009).
 */
export function puertosCobroSupabase(db: ClienteSupabase, sesion: Sesion): PuertosCobro {
  return {
    async leerLiquidacion(id) {
      const { data } = await db
        .from('v_liquidacion_estado')
        .select('liquidacion_id, evento_id, academia_id, numero, total_centavos, cobrado_centavos, moneda')
        .eq('liquidacion_id', id)
        .maybeSingle();
      if (!data?.liquidacion_id || !data.evento_id) return null;
      const { data: evento } = await db.from('evento').select('moneda, medios_cobro').eq('id', data.evento_id).single();
      if (!evento) return null;
      return {
        id: data.liquidacion_id,
        eventoId: data.evento_id,
        academiaId: data.academia_id ?? '',
        numero: data.numero ?? '',
        moneda: (data.moneda ?? evento.moneda) as Moneda,
        totalCentavos: Number(data.total_centavos ?? 0),
        cobradoCentavos: Number(data.cobrado_centavos ?? 0),
        mediosHabilitados: evento.medios_cobro,
      };
    },
    puede: (eventoId, permiso) => tienePermiso(sesion, eventoId, permiso),
    async insertarCobro(d) {
      // Idempotencia offline (ADR-0010): el mismo client_uuid devuelve el cobro ya registrado.
      const previo = await db.from('cobro').select('id').eq('client_uuid', d.clientUuid).maybeSingle();
      if (previo.data) return { id: previo.data.id, duplicado: true };
      const { data, error } = await db
        .from('cobro')
        .insert({
          evento_id: d.eventoId,
          academia_id: d.academiaId,
          liquidacion_id: d.liquidacionId,
          monto_centavos: d.montoCentavos,
          moneda: d.moneda,
          medio: d.medio,
          referencia: d.referencia ?? null,
          nota: d.nota ?? null,
          client_uuid: d.clientUuid,
          dispositivo_at: d.dispositivoAt ?? null,
          turno_caja_id: d.turnoId ?? null,
          registrado_por: sesion.usuarioId,
        })
        .select('id')
        .single();
      if (error?.code === '23505') {
        const repetido = await db.from('cobro').select('id').eq('client_uuid', d.clientUuid).single();
        if (repetido.data) return { id: repetido.data.id, duplicado: true };
      }
      if (error || !data) throw new Error(error?.message ?? 'COBRO_NO_REGISTRADO');
      return { id: data.id, duplicado: false };
    },
    async leerCobro(id) {
      const { data } = await db.from('cobro').select('id, evento_id, anulado_at').eq('id', id).maybeSingle();
      return data ? { id: data.id, eventoId: data.evento_id, anulado: data.anulado_at !== null } : null;
    },
    async anular(id, motivo) {
      const { error } = await db
        .from('cobro')
        .update({ anulado_at: new Date().toISOString(), anulado_por: sesion.usuarioId, motivo_anulacion: motivo })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    async turnoAbierto(eventoId) {
      const { data } = await db
        .from('turno_caja')
        .select('id')
        .eq('evento_id', eventoId)
        .eq('usuario_id', sesion.usuarioId)
        .is('cerrado_at', null)
        .order('abierto_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
  };
}
