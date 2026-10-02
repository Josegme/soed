import { esIdioma, type Idioma, type Traducible } from '@soed/domain';
import { NextResponse, type NextRequest } from 'next/server';
import { cronAutorizado } from '@/lib/cron';
import { formatearInstante } from '@/lib/i18n/formato';
import { texto } from '@/lib/i18n/traducible';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notificarAcademia } from '@/modules/notificaciones/infrastructure/encolar';

export const runtime = 'nodejs';

/**
 * Recordatorio diario de cierre de inscripción (OR-50): a las academias con
 * fichas sin enviar o sin música cuando faltan menos de 72 h. Una vez por
 * evento, academia y día (clave en el payload).
 */
export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ codigo: 'NO_AUTORIZADO' }, { status: 401 });
  const admin = supabaseAdmin();
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + 72 * 3600 * 1000).toISOString();
  const { data: eventos } = await admin
    .from('evento')
    .select('id, slug, nombre, idioma_defecto, zona_horaria, inscripcion_cierre')
    .eq('publicado', true)
    .gt('inscripcion_cierre', ahora.toISOString())
    .lte('inscripcion_cierre', limite);
  const hoy = ahora.toISOString().slice(0, 10);
  let enviados = 0;
  for (const e of eventos ?? []) {
    const { data: fichas } = await admin
      .from('ficha')
      .select('academia_id, estado, musica_path')
      .eq('evento_id', e.id)
      .neq('estado', 'RETIRADA');
    const pendientes = new Map<string, number>();
    for (const f of fichas ?? [])
      if (f.estado === 'BORRADOR' || f.estado === 'OBSERVADA' || !f.musica_path)
        pendientes.set(f.academia_id, (pendientes.get(f.academia_id) ?? 0) + 1);
    for (const [academiaId, cantidad] of pendientes) {
      const clave = `${e.id}:${academiaId}:${hoy}`;
      const { count } = await admin
        .from('email_envio')
        .select('id', { count: 'exact', head: true })
        .eq('plantilla', 'recordatorio_cierre')
        .eq('payload->>clave', clave);
      if (count) continue;
      const idioma: Idioma = esIdioma(e.idioma_defecto) ? e.idioma_defecto : 'es';
      enviados += await notificarAcademia({
        eventoId: e.id,
        academiaId,
        tipo: 'recordatorio_cierre',
        datos: {
          clave,
          evento: texto(e.nombre as Traducible, idioma, idioma),
          cierre: formatearInstante(e.inscripcion_cierre!, idioma, e.zona_horaria),
          pendientes: String(cantidad),
        },
        ruta: `/academia/eventos/${e.slug.toLowerCase()}`,
      });
    }
  }
  return NextResponse.json({ eventos: eventos?.length ?? 0, enviados });
}
