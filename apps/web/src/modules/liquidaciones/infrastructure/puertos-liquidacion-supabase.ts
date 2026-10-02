import 'server-only';
import type { Ajuste, Beneficio, CalculoLiquidacion, FichaALiquidar, Tarifario } from '@soed/domain';
import { tarifarioSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosLiquidacion } from '../application/liquidaciones';

export function puertosLiquidacionSupabase(db: ClienteSupabase, sesion: Sesion): PuertosLiquidacion {
  return {
    async leerInscripcion(id) {
      const { data: i } = await db
        .from('inscripcion')
        .select('id, evento_id, academia_id, rubros, evento:evento_id (tarifario)')
        .eq('id', id)
        .maybeSingle();
      if (!i) return null;
      const [fichas, ajustes, pases] = await Promise.all([
        db
          .from('ficha')
          .select('id, formacion, genero, categoria, estado, ficha_bailarin (bailarin_id, es_coreografo)')
          .eq('inscripcion_id', id),
        db.from('ajuste_liquidacion').select('tipo, monto_centavos, porcentaje, motivo').eq('inscripcion_id', id).is('anulado_at', null),
        db
          .from('pase')
          .select('beneficio, motivo')
          .eq('evento_destino_id', i.evento_id)
          .eq('academia_id', i.academia_id)
          .is('anulado_at', null),
      ]);
      const tarifario = tarifarioSchema.safeParse(i.evento?.tarifario);
      return {
        id: i.id,
        eventoId: i.evento_id,
        academiaId: i.academia_id,
        tarifario: tarifario.success ? (tarifario.data as Tarifario) : null,
        fichas: (fichas.data ?? []).map((f): FichaALiquidar => ({
          id: f.id,
          formacion: f.formacion,
          genero: f.genero,
          categoria: f.categoria,
          estado: f.estado as FichaALiquidar['estado'],
          integrantes: f.ficha_bailarin.map((b) => ({ bailarinId: b.bailarin_id, esCoreografo: b.es_coreografo })),
        })),
        rubros: Array.isArray(i.rubros) ? (i.rubros as { codigo: string; cantidad: number }[]) : [],
        ajustes: (ajustes.data ?? []).map((a): Ajuste => {
          if (a.tipo === 'SIN_CARGO') return { tipo: 'SIN_CARGO', motivo: a.motivo };
          if (a.tipo === 'DESCUENTO_PORCENTAJE')
            return { tipo: 'DESCUENTO_PORCENTAJE', porcentaje: Number(a.porcentaje), motivo: a.motivo };
          return { tipo: a.tipo as 'MONTO_LIBRE' | 'DESCUENTO_MONTO', monto: Number(a.monto_centavos), motivo: a.motivo };
        }),
        beneficios: (pases.data ?? [])
          .filter((p) => p.beneficio)
          .map((p) => ({ beneficio: p.beneficio as unknown as Beneficio, motivo: p.motivo })),
      };
    },
    async puedeVer(i) {
      return sesion.academias.some((a) => a.id === i.academiaId) || tienePermiso(sesion, i.eventoId, 'liquidaciones.ver');
    },
    async ultimaVersion(inscripcionId) {
      const { data } = await db
        .from('liquidacion_version')
        .select('version, total_centavos, detalle, liquidacion!inner (inscripcion_id)')
        .eq('liquidacion.inscripcion_id', inscripcionId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data
        ? { version: data.version, totalCentavos: Number(data.total_centavos), detalle: data.detalle as unknown as CalculoLiquidacion }
        : null;
    },
    async asegurarLiquidacion(inscripcionId) {
      const { data, error } = await supabaseAdmin().rpc('crear_liquidacion', { p_inscripcion: inscripcionId });
      if (error || !data) throw new Error(`crear liquidación: ${error?.message}`);
      return { id: data.id, numero: data.numero };
    },
    async insertarVersion(d) {
      const { error } = await supabaseAdmin()
        .from('liquidacion_version')
        .insert({
          liquidacion_id: d.liquidacionId,
          evento_id: d.eventoId,
          academia_id: d.academiaId,
          version: d.version,
          total_centavos: d.calculo.total,
          moneda: d.calculo.moneda,
          detalle: d.calculo as unknown as Json,
          idioma: d.idioma,
          emitida_por: sesion.usuarioId,
        });
      if (error) throw new Error(`versión de liquidación: ${error.message}`);
    },
  };
}
