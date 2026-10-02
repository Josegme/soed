import { Aviso, Tarjeta } from '@soed/ui';
import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { supabaseConfigurado } from '@/lib/entorno';
import { FormularioIngreso } from '@/modules/identidad/interface/formularios-auth';
import { idiomaDe } from '@/lib/i18n/locales';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const t = await getTranslations({ locale: idiomaDe((await params).locale), namespace: 'auth' });
  return { title: t('ingresarTitulo'), robots: { index: false } };
}

export default async function Ingresar({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('auth');
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t('ingresarTitulo')}</h1>
        <p className="text-texto-suave">{t('ingresarDescripcion')}</p>
      </div>
      {!supabaseConfigurado() ? <Aviso tono="alerta">{t('sinConfiguracion')}</Aviso> : null}
      <Tarjeta>
        <FormularioIngreso />
      </Tarjeta>
      <p className="text-sm text-texto-suave">
        {t('sinCuenta')}{' '}
        <Link href="/registro" className="font-semibold text-marca underline-offset-4 hover:underline">
          {t('crearCuenta')}
        </Link>
      </p>
    </div>
  );
}
