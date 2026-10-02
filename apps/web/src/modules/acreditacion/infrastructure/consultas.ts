import 'server-only';
import type { TipoCredencial } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

export interface CredencialFila {
  id: string;
  tipo: TipoCredencial;
  nombre: string;
  academia: string | null;
  academiaId: string | null;
  qrToken: string;
  acreditadoAt: string | null;
  anulada: boolean;
  zonas: string[];
}

/** Credenciales del evento (RLS: acreditacion.operar), con búsqueda por nombre. */
export async function credencialesDelEvento(
  db: ClienteSupabase,
  eventoId: string,
  filtros: { q?: string; academiaId?: string } = {},
): Promise<CredencialFila[]> {
  let consulta = db
    .from('credencial')
    .select('id, tipo, nombre_mostrado, qr_token, acreditado_at, anulada, zonas, academia_id, academia:academia_id (nombre)')
    .eq('evento_id', eventoId)
    .order('nombre_mostrado')
    .limit(500);
  if (filtros.q) consulta = consulta.ilike('nombre_mostrado', `%${filtros.q.replace(/[%_]/g, '')}%`);
  if (filtros.academiaId) consulta = consulta.eq('academia_id', filtros.academiaId);
  const { data } = await consulta;
  return (data ?? []).map((c) => ({
    id: c.id,
    tipo: c.tipo as TipoCredencial,
    nombre: c.nombre_mostrado,
    academia: c.academia?.nombre ?? null,
    academiaId: c.academia_id,
    qrToken: c.qr_token,
    acreditadoAt: c.acreditado_at,
    anulada: c.anulada,
    zonas: c.zonas,
  }));
}

export async function resumenAcreditacion(db: ClienteSupabase, eventoId: string) {
  const { data } = await db.from('credencial').select('tipo, acreditado_at, anulada').eq('evento_id', eventoId);
  const vigentes = (data ?? []).filter((c) => !c.anulada);
  return { total: vigentes.length, acreditadas: vigentes.filter((c) => c.acreditado_at).length };
}
