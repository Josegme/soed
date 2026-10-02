import 'server-only';
import type { Idioma, ReglamentoEvento, Traducible } from '@soed/domain';
import { notFound } from 'next/navigation';
import { requerirPermiso } from '@/lib/auth/sesion';
import { entornoPublico } from '@/lib/entorno';
import { ordenEnVivo } from '../infrastructure/consultas';

/** Sesión con el permiso de la vista, evento, orden y pista seleccionada (?pista=). */
export async function contextoVivo(eventoId: string, permiso: string, pistaPedida?: string) {
  const { db, sesion } = await requerirPermiso(eventoId, permiso);
  const { data: evento } = await db
    .from('evento')
    .select('nombre, idioma_defecto, zona_horaria, reglamento, config_operacion')
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) notFound();
  const pistas = await ordenEnVivo(db, eventoId);
  const pista = pistas.find((p) => p.id === pistaPedida) ?? pistas[0] ?? null;
  const entorno = entornoPublico();
  return {
    db,
    sesion,
    evento: {
      nombre: evento.nombre as Traducible,
      defecto: evento.idioma_defecto as Idioma,
      zonaHoraria: evento.zona_horaria,
      reglamento: evento.reglamento as unknown as ReglamentoEvento,
      config: evento.config_operacion as { intervaloSegundos?: number; duracionPorDefectoSegundos?: number; juradosPorFicha?: number },
    },
    pistas,
    pista,
    items: pista ? pista.bloques.flatMap((b) => b.items) : [],
    realtime: { url: entorno?.supabaseUrl ?? null, clave: entorno?.supabaseClave ?? null },
  };
}
