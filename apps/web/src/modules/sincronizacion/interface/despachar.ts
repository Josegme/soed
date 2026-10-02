import 'server-only';
import { acreditarSchema, guardarPlanillaSchema, registrarCobroSchema } from '@soed/shared-types';
import { z } from 'zod';
import type { Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import { acreditarPorToken } from '@/modules/acreditacion/application/acreditacion';
import { puertosAcreditacionSupabase } from '@/modules/acreditacion/infrastructure/puertos-acreditacion-supabase';
import { registrarCobro } from '@/modules/cobros/application/cobros';
import { puertosCobroSupabase } from '@/modules/cobros/infrastructure/puertos-cobro-supabase';
import { guardarPlanilla } from '@/modules/puntajes/application/planillas';
import { puertosPlanillaSupabase } from '@/modules/puntajes/infrastructure/puertos-planilla-supabase';
import { alRegistrarCobro } from '@/modules/notificaciones/infrastructure/efectos';

/** Operaciones que la cola offline puede reenviar (ADR-0010). Todas son idempotentes por client_uuid. */
export const operacionSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('planilla'), datos: guardarPlanillaSchema }),
  z.object({ tipo: z.literal('acreditacion'), datos: acreditarSchema }),
  z.object({ tipo: z.literal('cobro'), datos: registrarCobroSchema }),
]);
export type Operacion = z.infer<typeof operacionSchema>;

export type RespuestaSync = { ok: true; valor: unknown } | { ok: false; codigo: string };

/**
 * Ejecuta una operación encolada con la sesión del usuario: los mismos casos
 * de uso que la interfaz en línea, así que RLS, triggers y reglas del dominio
 * aplican igual. Un rechazo (ok: false) es definitivo; una excepción, reintentable.
 */
export async function despachar(op: Operacion, db: ClienteSupabase, sesion: Sesion, ahora: Date): Promise<RespuestaSync> {
  switch (op.tipo) {
    case 'planilla': {
      const r = await guardarPlanilla(puertosPlanillaSupabase(db, sesion), op.datos);
      return r.ok ? { ok: true, valor: r.value } : { ok: false, codigo: r.error.codigo };
    }
    case 'acreditacion': {
      const r = await acreditarPorToken(puertosAcreditacionSupabase(db, sesion), op.datos, ahora);
      return r.ok ? { ok: true, valor: r.value } : { ok: false, codigo: r.error.codigo };
    }
    case 'cobro': {
      const r = await registrarCobro(puertosCobroSupabase(db, sesion), op.datos);
      if (r.ok && !r.value.duplicado) await alRegistrarCobro(op.datos.liquidacionId, op.datos.montoCentavos, r.value.saldoCentavos);
      return r.ok ? { ok: true, valor: r.value } : { ok: false, codigo: r.error.codigo };
    }
  }
}
