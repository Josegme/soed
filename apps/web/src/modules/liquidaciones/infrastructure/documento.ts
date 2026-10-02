import 'server-only';
import type { CalculoLiquidacion, Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

/**
 * Datos de la última versión emitida de una liquidación, leídos con el cliente
 * del usuario: RLS permite solo a la academia dueña y a quien tiene
 * `liquidaciones.ver` en el evento.
 */
export async function datosDocumentoLiquidacion(db: ClienteSupabase, liquidacionId: string) {
  const { data: estado } = await db.from('v_liquidacion_estado').select('*').eq('liquidacion_id', liquidacionId).maybeSingle();
  if (!estado?.evento_id || !estado.academia_id || estado.version === null) return null;
  const [{ data: version }, { data: evento }, { data: academia }] = await Promise.all([
    db
      .from('liquidacion_version')
      .select('version, detalle, idioma, emitida_at')
      .eq('liquidacion_id', liquidacionId)
      .eq('version', estado.version)
      .single(),
    db.from('evento').select('nombre, idioma_defecto, datos_pago, zona_horaria, slug').eq('id', estado.evento_id).single(),
    db.from('academia').select('nombre').eq('id', estado.academia_id).single(),
  ]);
  if (!version || !evento) return null;
  const detalle = version.detalle as unknown as CalculoLiquidacion;
  const referencias = [...new Set((detalle.lineas ?? []).map((l) => l.referencia).filter((r): r is string => !!r))];
  const { data: fichas } = referencias.length ? await db.from('ficha').select('id, nombre').in('id', referencias) : { data: [] };
  return {
    numero: estado.numero ?? '',
    version: version.version,
    idiomaEmision: version.idioma,
    emitidaAt: version.emitida_at,
    moneda: estado.moneda ?? detalle.moneda,
    detalle,
    total: Number(estado.total_centavos ?? 0),
    cobrado: Number(estado.cobrado_centavos ?? 0),
    saldo: Number(estado.saldo_centavos ?? 0),
    evento: {
      nombre: evento.nombre as Traducible,
      defecto: evento.idioma_defecto,
      datosPago: evento.datos_pago as Traducible,
      zona: evento.zona_horaria,
    },
    academia: academia?.nombre ?? '',
    fichas: new Map((fichas ?? []).map((f) => [f.id, f.nombre])),
  };
}
