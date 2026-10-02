import 'server-only';
import type { ReglamentoEvento, Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

/**
 * Datos de los certificados de un evento (OR-44, PR-32), leídos con el
 * cliente del usuario: la RLS de `resultado` da todo al equipo que supervisa
 * puntajes y a cada academia solo lo suyo, y solo después de publicar (Art. 32).
 */
export async function datosCertificados(db: ClienteSupabase, eventoId: string, fichaId?: string) {
  const { data: evento } = await db
    .from('evento')
    .select('nombre, slug, idioma_defecto, fecha_inicio, fecha_fin, sede, reglamento')
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) return null;
  let consulta = db
    .from('resultado')
    .select(
      'ficha_id, academia_id, grupo, puesto, puntaje, banda, ficha!resultado_ficha_id_evento_id_academia_id_fkey (nombre, categoria, formacion, genero, ficha_bailarin (nombre_mostrado))',
    )
    .eq('evento_id', eventoId)
    .order('grupo')
    .order('puesto');
  if (fichaId) consulta = consulta.eq('ficha_id', fichaId);
  const { data: resultados } = await consulta;
  if (!resultados?.length) return { evento: aEvento(evento), certificados: [] };
  const ids = [...new Set(resultados.map((r) => r.academia_id))];
  const { data: academias } = await db.from('academia').select('id, nombre, ciudad').in('id', ids);
  const academia = new Map((academias ?? []).map((a) => [a.id, a]));
  return {
    evento: aEvento(evento),
    certificados: resultados.map((r) => ({
      fichaId: r.ficha_id,
      coreografia: r.ficha?.nombre ?? '',
      academia: academia.get(r.academia_id)?.nombre ?? '',
      ciudad: academia.get(r.academia_id)?.ciudad ?? null,
      categoria: r.ficha?.categoria ?? null,
      formacion: r.ficha?.formacion ?? '',
      genero: r.ficha?.genero ?? '',
      elenco: (r.ficha?.ficha_bailarin ?? []).map((b) => b.nombre_mostrado),
      puesto: r.puesto,
      puntaje: Number(r.puntaje),
      banda: r.banda,
    })),
  };
}

function aEvento(e: {
  nombre: unknown;
  slug: string;
  idioma_defecto: string;
  fecha_inicio: string;
  fecha_fin: string;
  sede: unknown;
  reglamento: unknown;
}) {
  return {
    nombre: e.nombre as Traducible,
    slug: e.slug,
    defecto: e.idioma_defecto,
    fechaInicio: e.fecha_inicio,
    fechaFin: e.fecha_fin,
    sede: (e.sede ?? {}) as { venue?: string; ciudad?: string; pais?: string },
    reglamento: e.reglamento as unknown as ReglamentoEvento | null,
  };
}
