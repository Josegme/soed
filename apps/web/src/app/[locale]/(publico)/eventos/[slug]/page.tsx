import type { Idioma } from '@soed/domain';
import { Aviso, estilosBoton, Insignia } from '@soed/ui';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InsigniaVentana } from '@/components/insignia-ventana';
import { Link } from '@/i18n/navigation';
import { formatearFecha, formatearInstante, formatearRangoFechas } from '@/lib/i18n/formato';
import { texto } from '@/lib/i18n/traducible';
import { agruparCronogramaPorDia, obtenerEventoPublico } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { idiomaDe } from '@/lib/i18n/locales';
import { moduloOn } from '@/lib/modulos';

export const revalidate = 120;

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = idiomaDe((await params).locale);
  const evento = await obtenerEventoPublico(repositorioEventosPublicos(), slug, new Date());
  return evento ? { title: texto(evento.nombre, locale, evento.idiomaDefecto as Idioma) } : {};
}

export default async function DetalleEvento({ params }: Props) {
  const { slug } = await params;
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const repo = repositorioEventosPublicos();
  const evento = await obtenerEventoPublico(repo, slug, new Date());
  if (!evento) notFound();
  const [filasCronograma, clases, entradas] = await Promise.all([
    repo.cronogramaPublico(evento.slug),
    moduloOn('clases') ? repo.clasesPublicas(evento.slug) : [],
    moduloOn('entradas') ? repo.entradasPublicas(evento.slug) : [],
  ]);
  const cronograma = agruparCronogramaPorDia(filasCronograma, evento.zonaHoraria);
  const t = await getTranslations('eventos');
  const defecto = evento.idiomaDefecto as Idioma;
  const lugar = [evento.sede.venue, evento.sede.ciudad, evento.sede.region, evento.sede.pais].filter(Boolean).join(', ');
  const bases = texto(evento.bases, locale, defecto);
  const fechaCierre = evento.inscripcionCierre
    ? formatearInstante(evento.inscripcionCierre, locale, evento.zonaHoraria, { dateStyle: 'long' })
    : null;
  const fechaApertura = evento.inscripcionApertura
    ? formatearInstante(evento.inscripcionApertura, locale, evento.zonaHoraria, { dateStyle: 'long' })
    : null;

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono="marca">{t(`tipo.${evento.tipo}`)}</Insignia>
          <InsigniaVentana ventana={evento.ventana} />
        </div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{texto(evento.nombre, locale, defecto)}</h1>
        <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-texto-suave">{t('fechas')}</dt>
            <dd className="font-semibold">{formatearRangoFechas(evento.fechaInicio, evento.fechaFin, locale)}</dd>
          </div>
          {lugar ? (
            <div>
              <dt className="text-sm text-texto-suave">{t('sede')}</dt>
              <dd className="font-semibold">{lugar}</dd>
            </div>
          ) : null}
        </dl>
        <p className="text-sm text-texto-suave">{t('zonaHoraria', { zona: evento.zonaHoraria })}</p>
      </header>

      <section className="flex flex-col gap-3 rounded-[var(--radio)] border border-borde bg-superficie p-5">
        {evento.ventana === 'ABIERTA' && fechaCierre ? <p>{t('inscripcionHasta', { fecha: fechaCierre })}</p> : null}
        {evento.ventana === 'NO_ABIERTA' && fechaApertura ? <p>{t('inscripcionDesde', { fecha: fechaApertura })}</p> : null}
        <div className="flex flex-wrap gap-3">
          {evento.ventana === 'ABIERTA' ? (
            <Link href={`/academia/eventos/${evento.slug.toLowerCase()}`} className={estilosBoton({ variante: 'primario' })}>
              {t('inscribirme')}
            </Link>
          ) : null}
          {evento.ordenPublicado && moduloOn('ordenEnVivo') ? (
            <Link href={`/eventos/${evento.slug.toLowerCase()}/orden`} className={estilosBoton({ variante: 'secundario' })}>
              {t('orden')}
            </Link>
          ) : null}
          {clases.length > 0 ? (
            <Link href={`/eventos/${evento.slug.toLowerCase()}/clases`} className={estilosBoton({ variante: 'secundario' })}>
              {t('clases')}
            </Link>
          ) : null}
          {entradas.length > 0 ? (
            <Link href={`/eventos/${evento.slug.toLowerCase()}/entradas`} className={estilosBoton({ variante: 'secundario' })}>
              {t('entradas')}
            </Link>
          ) : null}
          {evento.resultadosPublicados && moduloOn('puntajes') ? (
            <Link href={`/eventos/${evento.slug.toLowerCase()}/resultados`} className={estilosBoton({ variante: 'secundario' })}>
              {t('resultados')}
            </Link>
          ) : null}
        </div>
      </section>

      {cronograma.length > 0 ? (
        <section aria-labelledby="cronograma" className="flex flex-col gap-3">
          <h2 id="cronograma" className="font-display text-2xl font-bold">
            {t('cronograma')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {cronograma.map((d) => (
              <div key={d.dia} className="flex flex-col gap-3 rounded-[var(--radio)] border border-borde bg-superficie p-5">
                <h3 className="font-semibold first-letter:uppercase">{formatearFecha(d.dia, locale, { dateStyle: 'full' })}</h3>
                <ol className="flex flex-col gap-2">
                  {d.bloques.map((b) => (
                    <li key={`${b.inicio}-${JSON.stringify(b.bloque)}`} className="flex items-baseline gap-3">
                      <time dateTime={b.inicio} className="w-14 shrink-0 font-mono text-sm tabular-nums text-texto-suave">
                        {formatearInstante(b.inicio, locale, evento.zonaHoraria, { timeStyle: 'short' })}
                      </time>
                      <span className="flex flex-col">
                        <span className="font-medium">{texto(b.bloque, locale, defecto)}</span>
                        <span className="text-sm text-texto-suave">{texto(b.pista, locale, defecto)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="bases" className="flex flex-col gap-3">
        <h2 id="bases" className="font-display text-2xl font-bold">
          {t('bases')}
        </h2>
        {bases ? (
          <div className="max-w-prose whitespace-pre-line text-texto">{bases}</div>
        ) : (
          <Aviso tono="info">{t('basesPendientes')}</Aviso>
        )}
      </section>
    </article>
  );
}
