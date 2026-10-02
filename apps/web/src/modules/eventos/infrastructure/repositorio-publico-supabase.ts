import 'server-only';
import type { ReglamentoEvento, Traducible } from '@soed/domain';
import { supabasePublico } from '@/lib/supabase/publico';
import type {
  EventoPublico,
  FilaCronogramaPublico,
  FilaOrdenPublica,
  FilaResultadoPublico,
  RepositorioEventosPublicos,
} from '../application/eventos-publicos';

/** Columnas con grant para anon (migración 0800). Nunca usar select('*') con anon. */
const COLUMNAS =
  'id, slug, tipo, nombre, idioma_defecto, moneda, zona_horaria, sede, fecha_inicio, fecha_fin, inscripcion_apertura, inscripcion_cierre, modificaciones_cierre, bases, reglamento, orden_publicado_at, resultados_publicados_at';

type Fila = {
  id: string;
  slug: string;
  tipo: string;
  nombre: unknown;
  idioma_defecto: string;
  moneda: string;
  zona_horaria: string;
  sede: unknown;
  fecha_inicio: string;
  fecha_fin: string;
  inscripcion_apertura: string | null;
  inscripcion_cierre: string | null;
  modificaciones_cierre: string | null;
  bases: unknown;
  reglamento: unknown;
  orden_publicado_at: string | null;
  resultados_publicados_at: string | null;
};

const ahoraISO = () => new Date().toISOString();

function aEvento(f: Fila): EventoPublico {
  return {
    id: f.id,
    slug: f.slug,
    tipo: f.tipo as EventoPublico['tipo'],
    nombre: (f.nombre ?? {}) as Traducible,
    idiomaDefecto: f.idioma_defecto,
    moneda: f.moneda,
    zonaHoraria: f.zona_horaria,
    sede: (f.sede ?? {}) as EventoPublico['sede'],
    fechaInicio: f.fecha_inicio,
    fechaFin: f.fecha_fin,
    inscripcionApertura: f.inscripcion_apertura,
    inscripcionCierre: f.inscripcion_cierre,
    modificacionesCierre: f.modificaciones_cierre,
    bases: (f.bases ?? {}) as Traducible,
    reglamento: f.reglamento as ReglamentoEvento,
    ordenPublicado: f.orden_publicado_at !== null && f.orden_publicado_at <= ahoraISO(),
    resultadosPublicados: f.resultados_publicados_at !== null && f.resultados_publicados_at <= ahoraISO(),
  };
}

/** Implementación con Supabase (rol anon). Sin Supabase configurado devuelve vacío. */
export function repositorioEventosPublicos(): RepositorioEventosPublicos {
  const db = supabasePublico();
  return {
    async listarPublicados() {
      if (!db) return [];
      const { data, error } = await db.from('evento').select(COLUMNAS).eq('publicado', true).returns<Fila[]>();
      if (error) throw new Error(`eventos públicos: ${error.message}`);
      return (data ?? []).map(aEvento);
    },
    async buscarPorSlug(slug) {
      if (!db) return null;
      const { data, error } = await db.from('evento').select(COLUMNAS).eq('publicado', true).eq('slug', slug).maybeSingle<Fila>();
      if (error) throw new Error(`evento ${slug}: ${error.message}`);
      return data ? aEvento(data) : null;
    },
    async ordenPublico(slug) {
      if (!db) return [];
      const { data, error } = await db.rpc('publico_orden', { p_slug: slug });
      if (error) throw new Error(`orden ${slug}: ${error.message}`);
      return (data ?? []).map((f): FilaOrdenPublica => ({
        pista: (f.pista ?? {}) as Traducible,
        bloque: (f.bloque ?? {}) as Traducible,
        inicioProgramado: f.inicio_programado,
        posicion: f.posicion,
        estado: f.estado,
        coreografia: f.coreografia,
        academia: f.academia,
        ciudad: f.ciudad,
        categoria: f.categoria,
        formacion: f.formacion,
        genero: f.genero,
      }));
    },
    async resultadosPublicos(slug) {
      if (!db) return [];
      const { data, error } = await db.rpc('publico_resultados', { p_slug: slug });
      if (error) throw new Error(`resultados ${slug}: ${error.message}`);
      return (data ?? []).map((f): FilaResultadoPublico => ({
        grupo: f.grupo,
        puesto: f.puesto,
        puntaje: Number(f.puntaje),
        banda: f.banda,
        coreografia: f.coreografia,
        academia: f.academia,
        ciudad: f.ciudad,
        categoria: f.categoria,
        formacion: f.formacion,
        genero: f.genero,
      }));
    },
    async cronogramaPublico(slug) {
      if (!db) return [];
      const { data, error } = await db.rpc('publico_cronograma', { p_slug: slug });
      if (error) throw new Error(`cronograma ${slug}: ${error.message}`);
      return (data ?? []).map((f): FilaCronogramaPublico => ({
        pista: (f.pista ?? {}) as Traducible,
        bloque: (f.bloque ?? {}) as Traducible,
        inicio: f.inicio_programado,
      }));
    },
  };
}
