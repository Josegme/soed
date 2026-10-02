import type { EstadoEvento, Idioma } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { EncabezadoPagina, EstadoVacio, GrupoIndicadores, Indicador, Insignia, Tabla, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearMonto, formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { tableroTemporada } from '@/modules/temporadas/infrastructure/consultas';
import { EnlacesTemporada } from '@/modules/temporadas/interface/enlaces';

/** Tablero de la temporada: participación y cobranza por evento y por moneda (SA-10, SA-11). */
export default async function TableroTemporada({ params }: { params: Promise<{ locale: string; temporadaId: string }> }) {
  const { locale, temporadaId } = await params;
  if (!uuidSchema.safeParse(temporadaId).success) notFound();
  const idioma: Idioma = idiomaDe(locale);
  const { db } = await requerirSesion();
  const datos = await tableroTemporada(db, temporadaId);
  if (!datos) notFound();
  const t = await getTranslations('admin.temporada');
  const te = await getTranslations('estados.evento');
  const { temporada, eventos, resumen } = datos;
  const metricas = new Map(resumen.eventos.map((m) => [m.eventoId, m]));

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={texto(temporada.nombre, idioma)}
        descripcion={t('descripcion', { anio: temporada.anio })}
        acciones={<EnlacesTemporada temporadaId={temporadaId} actual="tablero" />}
      />

      <GrupoIndicadores className="sm:grid-cols-2 lg:grid-cols-4">
        <Indicador etiqueta={t('eventos')} valor={String(eventos.length)} />
        <Indicador etiqueta={t('academias')} valor={String(resumen.academias)} detalle={t('academiasDetalle')} />
        <Indicador etiqueta={t('fichas')} valor={String(resumen.fichas)} />
        {resumen.totales.map((m) => (
          <Indicador
            key={m.moneda}
            etiqueta={t('cobradoMoneda', { moneda: m.moneda })}
            valor={formatearMonto(m.cobrado, m.moneda, idioma)}
            detalle={t('avance', { avance: m.avance, esperado: formatearMonto(m.esperado, m.moneda, idioma) })}
          />
        ))}
      </GrupoIndicadores>

      <section aria-labelledby="eventos-temporada" className="flex flex-col gap-3">
        <h2 id="eventos-temporada" className="font-display text-xl font-bold">
          {t('porEvento')}
        </h2>
        {eventos.length === 0 ? (
          <EstadoVacio titulo={t('sinEventos')} />
        ) : (
          <Tabla>
            <caption className="sr-only">{t('porEvento')}</caption>
            <thead>
              <tr>
                <Th>{t('evento')}</Th>
                <Th>{t('estado')}</Th>
                <Th className="text-right">{t('academias')}</Th>
                <Th className="text-right">{t('fichas')}</Th>
                <Th className="text-right">{t('esperado')}</Th>
                <Th className="text-right">{t('cobrado')}</Th>
                <Th className="text-right">{t('pendiente')}</Th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((e) => {
                const m = metricas.get(e.id);
                const cobranza = m?.cobranza ?? [];
                const monto = (campo: 'esperado' | 'cobrado' | 'pendiente') =>
                  cobranza.length === 0 ? '—' : cobranza.map((c) => formatearMonto(c[campo], c.moneda, idioma)).join(' · ');
                return (
                  <tr key={e.id}>
                    <Td>
                      <Link href={`/gestion/${e.id}`} className="font-medium text-marca underline-offset-4 hover:underline">
                        {texto(e.nombre, idioma, e.idioma_defecto as Idioma)}
                      </Link>
                      <p className="text-xs text-texto-suave">
                        {e.slug} · {formatearRangoFechas(e.fecha_inicio, e.fecha_fin, idioma)}
                      </p>
                    </Td>
                    <Td>
                      <Insignia tono={e.publicado ? 'exito' : 'neutro'}>{te(e.estado as EstadoEvento)}</Insignia>
                    </Td>
                    <Td className="text-right tabular-nums">{m?.academias ?? 0}</Td>
                    <Td className="text-right tabular-nums">
                      {m?.fichas ?? 0}
                      <span className="block text-xs text-texto-suave">{t('aprobadas', { cantidad: m?.fichasAprobadas ?? 0 })}</span>
                    </Td>
                    <Td className="text-right tabular-nums">{monto('esperado')}</Td>
                    <Td className="text-right tabular-nums">{monto('cobrado')}</Td>
                    <Td className="text-right font-semibold tabular-nums">{monto('pendiente')}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Tabla>
        )}
        <p className="text-sm text-texto-suave">{t('aclaracionMonedas')}</p>
      </section>
    </div>
  );
}
