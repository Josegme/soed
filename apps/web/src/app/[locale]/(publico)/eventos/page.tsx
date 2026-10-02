import { EncabezadoPagina, EstadoVacio } from '@soed/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TarjetaEvento } from '@/components/tarjeta-evento';
import { listarEventosPublicos } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { idiomaDe } from '@/lib/i18n/locales';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: idiomaDe((await params).locale), namespace: 'eventos' });
  return { title: t('titulo'), description: t('descripcion') };
}

export default async function Eventos({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('eventos');
  const ti = await getTranslations('inicio');
  const eventos = await listarEventosPublicos(repositorioEventosPublicos(), new Date());
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={t('descripcion')} />
      {eventos.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {eventos.map((e) => (
            <TarjetaEvento key={e.id} evento={e} idioma={locale} />
          ))}
        </ul>
      ) : (
        <EstadoVacio titulo={ti('sinEventos')} descripcion={ti('sinConexion')} />
      )}
    </div>
  );
}
