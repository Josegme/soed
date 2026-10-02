import type { Idioma } from '@soed/domain';
import { Aviso, EncabezadoPagina, Insignia, Tarjeta } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { exigirModulo } from '@/lib/modulos';
import { texto } from '@/lib/i18n/traducible';
import { FormularioReservaPublica } from '@/modules/actividades/interface/reserva-publica';
import { obtenerEventoPublico } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';

export const revalidate = 60;

/** Catálogo y reserva de clases sin cuenta (PU-09). El pago es manual en el evento. */
export default async function ClasesPublicas({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  exigirModulo('clases');
  const { slug } = await params;
  const locale: Idioma = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const repo = repositorioEventosPublicos();
  const evento = await obtenerEventoPublico(repo, slug, new Date());
  if (!evento) notFound();
  const clases = await repo.clasesPublicas(evento.slug);
  const t = await getTranslations('eventos');
  const defecto = evento.idiomaDefecto as Idioma;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t('clases')} descripcion={texto(evento.nombre, locale, defecto)} />
      {clases.length === 0 ? <Aviso tono="info">{t('sinClases')}</Aviso> : null}
      <ul className="flex flex-col gap-4">
        {clases.map((c) => {
          const nombre = texto(c.nombre, locale, defecto);
          return (
            <li key={c.id}>
              <Tarjeta className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-lg font-bold">{nombre}</h2>
                    <p className="text-sm text-texto-suave">
                      {formatearInstante(c.inicio, locale, evento.zonaHoraria)}
                      {c.docente ? ` · ${c.docente}` : ''}
                      {c.sala ? ` · ${c.sala}` : ''}
                    </p>
                    <p className="text-sm font-medium">{c.precio > 0 ? formatearMonto(c.precio, c.moneda, locale) : t('gratis')}</p>
                  </div>
                  <Insignia tono={c.disponibles > 0 ? 'exito' : 'neutro'}>
                    {c.disponibles > 0 ? t('disponibles', { cantidad: c.disponibles }) : t('agotada')}
                  </Insignia>
                </div>
                {c.disponibles > 0 ? <FormularioReservaPublica tipo="clase" id={c.id} maximo={1} etiqueta={nombre} /> : null}
              </Tarjeta>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
