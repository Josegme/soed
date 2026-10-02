import { estadoVentana, type Moneda } from '@soed/domain';
import { Aviso, Indicador, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { InsigniaVentana } from '@/components/insignia-ventana';
import { Link } from '@/i18n/navigation';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { resumenGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

/** Tablero del evento (OR-14): estado de inscripciones, cobranza y jurado de un vistazo. */
export default async function ResumenGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma = idiomaDe(locale);
  const { db, evento, puede } = await contextoGestion(eventoId, 'resumen');
  const r = await resumenGestion(db, eventoId);
  const t = await getTranslations('gestion.resumen');
  const te = await getTranslations('estados.ficha');
  const ventana = estadoVentana(
    { apertura: evento.inscripcion_apertura, cierre: evento.inscripcion_cierre, cierreModificaciones: evento.modificaciones_cierre },
    new Date(),
  );
  const cobranza = r.cobranza.find((c) => c.moneda === evento.moneda);
  const monto = (c: number | null | undefined) => formatearMonto(Number(c ?? 0), evento.moneda as Moneda, idioma);
  const fecha = (i: string | null) => (i ? formatearInstante(i, idioma, evento.zona_horaria) : t('sinDefinir'));

  return (
    <div className="flex flex-col gap-6">
      {!evento.reglamentoValido ? <Aviso tono="error">{t('reglamentoIncompleto')}</Aviso> : null}
      {r.solicitudesPendientes > 0 && puede('inscripciones.gestionar') ? (
        <Aviso tono="alerta">
          <Link href={`/gestion/${eventoId}/inscripciones#solicitudes`} className="underline underline-offset-4">
            {t('solicitudesPendientes', { cantidad: r.solicitudesPendientes })}
          </Link>
        </Aviso>
      ) : null}

      <section aria-labelledby="indicadores" className="flex flex-col gap-3">
        <h2 id="indicadores" className="sr-only">
          {t('indicadores')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Indicador etiqueta={t('academias')} valor={String(r.academias)} />
          <Indicador
            etiqueta={t('fichas')}
            valor={String(r.fichasTotal)}
            detalle={t('fichasDetalle', { aprobadas: r.fichasPorEstado.APROBADA ?? 0, enviadas: r.fichasPorEstado.ENVIADA ?? 0 })}
          />
          {puede('liquidaciones.ver') ? (
            <>
              <Indicador
                etiqueta={t('cobrado')}
                valor={monto(cobranza?.cobrado_centavos)}
                detalle={t('esperado', { monto: monto(cobranza?.esperado_centavos) })}
              />
              <Indicador
                etiqueta={t('pendiente')}
                valor={monto(cobranza?.pendiente_centavos)}
                detalle={t('liquidaciones', { cantidad: Number(cobranza?.liquidaciones ?? 0) })}
              />
            </>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{t('ventana')}</h2>
            <InsigniaVentana ventana={ventana} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-texto-suave">{t('apertura')}</dt>
            <dd>{fecha(evento.inscripcion_apertura)}</dd>
            <dt className="text-texto-suave">{t('cierre')}</dt>
            <dd>{fecha(evento.inscripcion_cierre)}</dd>
            <dt className="text-texto-suave">{t('cierreModificaciones')}</dt>
            <dd>{fecha(evento.modificaciones_cierre)}</dd>
            <dt className="text-texto-suave">{t('cupo')}</dt>
            <dd>{evento.cupo_fichas ?? t('sinCupo')}</dd>
          </dl>
          {puede('evento.configurar') ? (
            <Link href={`/gestion/${eventoId}/configuracion`} className="text-sm font-medium text-marca underline-offset-4 hover:underline">
              {t('configurar')}
            </Link>
          ) : null}
        </Tarjeta>

        <Tarjeta className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold">{t('fichasPorEstado')}</h2>
          <ul className="flex flex-col gap-2">
            {(['BORRADOR', 'ENVIADA', 'OBSERVADA', 'APROBADA', 'RETIRADA'] as const).map((estado) => {
              const cantidad = r.fichasPorEstado[estado] ?? 0;
              const porcentaje = r.fichasTotal ? Math.round((cantidad / r.fichasTotal) * 100) : 0;
              return (
                <li key={estado} className="flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span>{te(estado)}</span>
                    <span className="tabular-nums text-texto-suave">{cantidad}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-superficie-2" aria-hidden="true">
                    <div className="h-full rounded-full bg-marca" style={{ width: `${porcentaje}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {r.bloqueadas > 0 ? <p className="text-sm text-texto-suave">{t('bloqueadas', { cantidad: r.bloqueadas })}</p> : null}
        </Tarjeta>

        {puede('puntajes.supervisar') ? (
          <Tarjeta className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">{t('jurado')}</h2>
            <p className="text-sm">{t('planillas', { enviadas: r.planillasEnviadas, total: r.planillasTotal })}</p>
            <p className="text-sm text-texto-suave">
              {evento.resultados_publicados_at
                ? t('resultadosPublicados', { fecha: fecha(evento.resultados_publicados_at) })
                : t('resultadosSinPublicar')}
            </p>
          </Tarjeta>
        ) : null}
      </div>
    </div>
  );
}
