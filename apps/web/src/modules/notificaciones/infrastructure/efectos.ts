import 'server-only';
import type { Moneda, Traducible } from '@soed/domain';
import { formatearMonto } from '@/lib/i18n/formato';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notificarAcademia, notificarAcademiasDelEvento, sinFallar } from './encolar';

/**
 * Efectos de notificación de las operaciones (PR-22). Leen lo necesario con la
 * clave de servidor (la operación ya fue autorizada y ejecutada con RLS) y
 * nunca propagan errores a la operación original.
 */
async function evento(eventoId: string) {
  const { data } = await supabaseAdmin().from('evento').select('nombre, slug, moneda').eq('id', eventoId).single();
  return data ? { nombre: data.nombre as Traducible, slug: data.slug.toLowerCase(), moneda: data.moneda as Moneda } : null;
}

export const alInscribirAcademia = (eventoId: string, academiaId: string) =>
  sinFallar(async () => {
    const e = await evento(eventoId);
    if (e)
      await notificarAcademia({
        eventoId,
        academiaId,
        tipo: 'inscripcion_confirmada',
        datos: { evento: e.nombre },
        ruta: `/academia/eventos/${e.slug}`,
      });
  });

export const alEmitirLiquidacion = (inscripcionId: string, numero: string, totalCentavos: number) =>
  sinFallar(async () => {
    const { data: i } = await supabaseAdmin().from('inscripcion').select('evento_id, academia_id').eq('id', inscripcionId).single();
    const e = i ? await evento(i.evento_id) : null;
    if (!i || !e) return;
    await notificarAcademia({
      eventoId: i.evento_id,
      academiaId: i.academia_id,
      tipo: 'liquidacion_emitida',
      datos: { evento: e.nombre, numero, total: (idioma) => formatearMonto(totalCentavos, e.moneda, idioma) },
      ruta: `/academia/eventos/${e.slug}`,
    });
  });

export const alRegistrarCobro = (liquidacionId: string, montoCentavos: number, saldoCentavos: number) =>
  sinFallar(async () => {
    const { data: l } = await supabaseAdmin().from('liquidacion').select('evento_id, academia_id, numero').eq('id', liquidacionId).single();
    const e = l ? await evento(l.evento_id) : null;
    if (!l || !e) return;
    await notificarAcademia({
      eventoId: l.evento_id,
      academiaId: l.academia_id,
      tipo: 'cobro_registrado',
      datos: {
        evento: e.nombre,
        numero: l.numero,
        monto: (idioma) => formatearMonto(montoCentavos, e.moneda, idioma),
        saldo: (idioma) => formatearMonto(Math.max(0, saldoCentavos), e.moneda, idioma),
      },
      ruta: `/academia/eventos/${e.slug}`,
    });
  });

export const alObservarFicha = (fichaId: string, observacion: string) =>
  sinFallar(async () => {
    const { data: f } = await supabaseAdmin().from('ficha').select('evento_id, academia_id, nombre').eq('id', fichaId).single();
    const e = f ? await evento(f.evento_id) : null;
    if (!f || !e) return;
    await notificarAcademia({
      eventoId: f.evento_id,
      academiaId: f.academia_id,
      tipo: 'ficha_observada',
      datos: { evento: e.nombre, ficha: f.nombre, observacion },
      ruta: `/academia/eventos/${e.slug}`,
    });
  });

export const alPublicar = (eventoId: string, tipo: 'orden_publicado' | 'resultados_publicados') =>
  sinFallar(async () => {
    const e = await evento(eventoId);
    if (!e) return;
    await notificarAcademiasDelEvento({
      eventoId,
      tipo,
      datos: { evento: e.nombre },
      ruta: `/eventos/${e.slug}/${tipo === 'orden_publicado' ? 'orden' : 'resultados'}`,
    });
  });
