import { estadoVentana, type Beneficio, type Idioma } from '@soed/domain';
import { EncabezadoPagina, EstadoVacio, GrupoIndicadores, Indicador, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { InsigniaVentana } from '@/components/insignia-ventana';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { Link } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearPuntaje, formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { moduloOn } from '@/lib/modulos';
import {
  academiaActiva,
  comunicadosDeAcademia,
  eventosPublicadosParaAcademia,
  historialDeAcademia,
  pasesDeAcademia,
  resumenAcademia,
} from '@/modules/academias/infrastructure/consultas';
import { FormularioAcademia } from '@/modules/academias/interface/formularios';

export default async function PanelAcademia({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const locale = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const t = await getTranslations('academia');
  const academia = academiaActiva(sesion, (await searchParams).a);

  if (!academia) {
    return (
      <div className="flex max-w-2xl flex-col gap-6">
        <EncabezadoPagina titulo={t('crearTitulo')} descripcion={t('crearDescripcion')} />
        <FormularioAcademia />
      </div>
    );
  }

  const [resumen, eventos, pases, comunicados, historial] = await Promise.all([
    resumenAcademia(db, academia.id),
    eventosPublicadosParaAcademia(db),
    pasesDeAcademia(db, academia.id),
    comunicadosDeAcademia(db),
    moduloOn('puntajes') ? historialDeAcademia(db, academia.id) : [],
  ]);
  const ahora = new Date();
  const detalleBeneficio = (b: Beneficio | null) =>
    !b ? null : b.tipo === 'BECA' ? t('resumen.beca') : b.tipo === 'DESCUENTO_PORCENTAJE' ? `${b.porcentaje} %` : null;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={academia.nombre} />
      <PestanasAcademia activa="resumen" />
      <GrupoIndicadores className="sm:grid-cols-3">
        <Indicador etiqueta={t('resumen.bailarines')} valor={String(resumen.bailarines)} />
        <Indicador etiqueta={t('resumen.coreografias')} valor={String(resumen.coreografias)} />
        <Indicador etiqueta={t('resumen.inscripciones')} valor={String(resumen.eventosInscriptos.size)} />
      </GrupoIndicadores>

      <section className="flex flex-col gap-3" aria-labelledby="eventos-temporada">
        <h2 id="eventos-temporada" className="font-display text-xl font-bold">
          {t('resumen.eventos')}
        </h2>
        {eventos.length === 0 ? <EstadoVacio titulo={t('resumen.sinEventos')} /> : null}
        <ul className="grid gap-3 lg:grid-cols-2">
          {eventos.map((e) => {
            const ventana = estadoVentana(
              { apertura: e.inscripcion_apertura, cierre: e.inscripcion_cierre, cierreModificaciones: e.modificaciones_cierre },
              ahora,
            );
            const inscripta = resumen.eventosInscriptos.has(e.id);
            return (
              <li key={e.id}>
                <Tarjeta className="flex h-full flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <InsigniaVentana ventana={ventana} />
                    {inscripta ? <Insignia tono="exito">{t('resumen.inscripta')}</Insignia> : null}
                  </div>
                  <p className="font-display text-lg font-bold">{texto(e.nombre, locale, e.idioma_defecto as Idioma)}</p>
                  <p className="text-sm text-texto-suave">{formatearRangoFechas(e.fecha_inicio, e.fecha_fin, locale)}</p>
                  <Link
                    href={`/academia/eventos/${e.slug.toLowerCase()}`}
                    className="mt-auto font-semibold text-marca underline-offset-4 hover:underline"
                  >
                    {inscripta || ventana === 'ABIERTA' ? t('resumen.gestionar') : t('resumen.verEvento')}
                  </Link>
                </Tarjeta>
              </li>
            );
          })}
        </ul>
      </section>

      {historial.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="historial">
          <h2 id="historial" className="font-display text-xl font-bold">
            {t('resumen.historial')}
          </h2>
          <Tabla>
            <caption className="sr-only">{t('resumen.historial')}</caption>
            <thead>
              <tr>
                <Th>{t('resumen.evento')}</Th>
                <Th>{t('resumen.coreografia')}</Th>
                <Th className="text-right">{t('resumen.puesto')}</Th>
                <Th className="text-right">{t('resumen.puntaje')}</Th>
                <Th>{t('resumen.banda')}</Th>
              </tr>
            </thead>
            <tbody>
              {historial.map((h) => (
                <tr key={h.fichaId}>
                  <Td>{texto(h.evento.nombre, locale, h.evento.defecto as Idioma)}</Td>
                  <Td className="font-medium">{h.coreografia}</Td>
                  <Td className="text-right tabular-nums">{h.puesto}</Td>
                  <Td className="text-right tabular-nums">{formatearPuntaje(h.puntaje, locale)}</Td>
                  <Td>{h.banda ? texto(h.banda, locale) : '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </section>
      ) : null}

      {pases.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="pases">
          <h2 id="pases" className="font-display text-xl font-bold">
            {t('resumen.pases')}
          </h2>
          <ul className="flex flex-col gap-2">
            {pases.map((p) => {
              const beneficio = detalleBeneficio(p.beneficio as unknown as Beneficio | null);
              return (
                <li key={p.id}>
                  <Tarjeta className="flex flex-col gap-1">
                    <p className="font-semibold">
                      {texto(p.evento_destino?.nombre, locale, (p.evento_destino?.idioma_defecto ?? 'es') as Idioma)}
                    </p>
                    <p className="text-sm text-texto-suave">{p.motivo}</p>
                    {beneficio ? <p className="text-sm">{t('resumen.beneficio', { detalle: beneficio })}</p> : null}
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {comunicados.length > 0 ? (
        <section className="flex flex-col gap-3" aria-labelledby="comunicados">
          <h2 id="comunicados" className="font-display text-xl font-bold">
            {t('resumen.comunicados')}
          </h2>
          <ul className="flex flex-col gap-2">
            {comunicados.map((c) => (
              <li key={c.id}>
                <Tarjeta className="flex flex-col gap-1">
                  <p className="font-semibold">{texto(c.asunto, locale)}</p>
                  <p className="whitespace-pre-line text-sm">{texto(c.cuerpo, locale)}</p>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
