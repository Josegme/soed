import { Aviso, EncabezadoPagina } from '@soed/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { idiomaDe } from '@/lib/i18n/locales';

/** Página que el service worker muestra al navegar sin conexión (PU-14). */
export default async function SinConexion({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale(idiomaDe((await params).locale));
  const t = await getTranslations('sinConexion');
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16 sm:px-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={t('descripcion')} />
      <Aviso tono="info">{t('cola')}</Aviso>
    </div>
  );
}
