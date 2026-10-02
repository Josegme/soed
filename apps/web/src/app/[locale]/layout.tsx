import { idiomaDe } from '@/lib/i18n/locales';
import type { Idioma } from '@soed/domain';
import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cliente } from '@/cliente';
import { routing } from '@/i18n/routing';
import { ETIQUETA_LANG, PREFIJO_URL } from '@/lib/i18n/locales';
import { urlSitio } from '@/lib/entorno';
import { fuenteDisplay, fuenteTexto } from '../fuentes';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: idiomaDe(locale), namespace: 'metadatos' });
  const idiomas = Object.fromEntries(routing.locales.map((l) => [ETIQUETA_LANG[l], `${PREFIJO_URL[l]}`]));
  return {
    metadataBase: new URL(urlSitio()),
    title: { default: t('titulo', { cliente: cliente.nombre }), template: `%s · ${cliente.nombreCorto}` },
    description: t('descripcion'),
    icons: { icon: cliente.marca.favicon },
    alternates: { canonical: PREFIJO_URL[locale as Idioma], languages: idiomas },
    openGraph: { siteName: cliente.nombre, locale: locale.replace('-', '_'), type: 'website' },
  };
}

export const viewport: Viewport = { themeColor: cliente.marca.colorTema, width: 'device-width', initialScale: 1 };

export default async function LayoutIdioma({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('navegacion');

  return (
    <html lang={ETIQUETA_LANG[locale]} className={`${fuenteTexto.variable} ${fuenteDisplay.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <a
          href="#contenido"
          className="sr-only z-50 rounded-md bg-marca px-4 py-2 text-marca-contraste focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {t('saltarContenido')}
        </a>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
