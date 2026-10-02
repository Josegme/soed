import type { Idioma } from '@soed/domain';
import { Aviso, EncabezadoPagina, Insignia, Tarjeta } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatearFecha, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { FormularioReservaPublica } from '@/modules/actividades/interface/reserva-publica';
import { obtenerEventoPublico } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';

export const revalidate = 60;

/** Tipos de entrada, precios y reserva sin cuenta (PU-10). El pago es manual en el evento. */
export default async function EntradasPublicas({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale: Idioma = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const repo = repositorioEventosPublicos();
  const evento = await obtenerEventoPublico(repo, slug, new Date());
  if (!evento) notFound();
  const entradas = await repo.entradasPublicas(evento.slug);
  const t = await getTranslations('eventos');
  const defecto = evento.idiomaDefecto as Idioma;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t('entradas')} descripcion={texto(evento.nombre, locale, defecto)} />
      {entradas.length === 0 ? <Aviso tono="info">{t('sinEntradas')}</Aviso> : null}
      <ul className="flex flex-col gap-4">
        {entradas.map((e) => {
          const nombre = texto(e.nombre, locale, defecto);
          return (
            <li key={e.id}>
              <Tarjeta className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 className="font-display text-lg font-bold">{nombre}</h2>
                    <p className="text-sm text-texto-suave">
                      {e.fecha ? `${formatearFecha(e.fecha, locale)} · ` : ''}
                      {e.precio > 0 ? formatearMonto(e.precio, e.moneda, locale) : t('gratis')}
                    </p>
                  </div>
                  <Insignia tono={e.disponibles > 0 ? 'exito' : 'neutro'}>
                    {e.disponibles > 0 ? t('disponibles', { cantidad: e.disponibles }) : t('agotada')}
                  </Insignia>
                </div>
                {e.disponibles > 0 ? <FormularioReservaPublica tipo="entrada" id={e.id} maximo={e.disponibles} etiqueta={nombre} /> : null}
              </Tarjeta>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
