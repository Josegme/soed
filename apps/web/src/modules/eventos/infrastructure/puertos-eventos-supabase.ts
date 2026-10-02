import 'server-only';
import type { ReglamentoEvento, Traducible } from '@soed/domain';
import { reglamentoSchema } from '@soed/shared-types';
import type { Json } from '@soed/shared-types/database';
import type { Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { ConfiguracionClonable, PuertosEventos } from '../application/crear-evento';

/** Alta de eventos (solo Super Admin por RLS). Criterios y pistas se copian en el mismo flujo. */
export function puertosEventosSupabase(db: ClienteSupabase, sesion: Sesion): PuertosEventos {
  return {
    esSuperAdmin: () => sesion.esSuperAdmin,
    async reglamentoDeTemporada(temporadaId) {
      const { data } = await db.from('temporada').select('reglamento:reglamento_id (config)').eq('id', temporadaId).maybeSingle();
      const r = reglamentoSchema.safeParse(data?.reglamento?.config);
      return r.success ? (r.data as ReglamentoEvento) : null;
    },
    async configuracionDe(eventoId) {
      const [{ data: e }, { data: criterios }, { data: pistas }] = await Promise.all([
        db.from('evento').select('reglamento, tarifario, medios_cobro, datos_pago, bases, config_operacion').eq('id', eventoId).maybeSingle(),
        db.from('criterio').select('codigo, nombre, peso, orden').eq('evento_id', eventoId).order('orden'),
        db.from('pista').select('nombre, orden').eq('evento_id', eventoId).order('orden'),
      ]);
      const r = reglamentoSchema.safeParse(e?.reglamento);
      if (!e || !r.success) return null;
      return {
        reglamento: r.data as ReglamentoEvento,
        tarifario: e.tarifario as Record<string, unknown>,
        mediosCobro: e.medios_cobro,
        datosPago: e.datos_pago as Traducible,
        bases: e.bases as Traducible,
        configOperacion: e.config_operacion as Record<string, unknown>,
        criterios: (criterios ?? []).map((c) => ({ codigo: c.codigo, nombre: c.nombre as Traducible, peso: Number(c.peso), orden: c.orden })),
        pistas: (pistas ?? []).map((p) => ({ nombre: p.nombre as Traducible, orden: p.orden })),
      } satisfies ConfiguracionClonable;
    },
    async slugDisponible(slug) {
      const { count } = await db.from('evento').select('id', { count: 'exact', head: true }).eq('slug', slug);
      return (count ?? 0) === 0;
    },
    async insertarEvento(e, c) {
      const { data, error } = await db
        .from('evento')
        .insert({
          temporada_id: e.temporadaId,
          slug: e.slug,
          tipo: e.tipo,
          nombre: e.nombre as Json,
          moneda: e.moneda,
          idioma_defecto: e.idiomaDefecto,
          zona_horaria: e.zonaHoraria,
          fecha_inicio: e.fechaInicio,
          fecha_fin: e.fechaFin,
          sede: e.sede as Json,
          reglamento: c.reglamento as unknown as Json,
          tarifario: c.tarifario as Json,
          medios_cobro: c.mediosCobro,
          datos_pago: c.datosPago as Json,
          bases: c.bases as Json,
          config_operacion: c.configOperacion as Json,
          creado_por: sesion.usuarioId,
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'EVENTO_NO_CREADO');
      const eventoId = data.id;
      if (c.criterios.length > 0) {
        const r = await db.from('criterio').insert(c.criterios.map((x) => ({ ...x, nombre: x.nombre as Json, evento_id: eventoId })));
        if (r.error) throw new Error(r.error.message);
      }
      if (c.pistas.length > 0) {
        const r = await db.from('pista').insert(c.pistas.map((x) => ({ ...x, nombre: x.nombre as Json, evento_id: eventoId })));
        if (r.error) throw new Error(r.error.message);
      }
      return eventoId;
    },
  };
}
