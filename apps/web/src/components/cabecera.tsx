import { getTranslations } from 'next-intl/server';
import { cliente } from '@/cliente';
import { Link } from '@/i18n/navigation';
import { SelectorIdioma } from './selector-idioma';

/** Cabecera pública: estática (sin cookies) para permitir render estático del sitio. */
export async function Cabecera() {
  const t = await getTranslations('navegacion');
  return (
    <header className="border-b border-borde bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG de la instancia, tamaño fijo */}
          <img src={cliente.marca.logo} alt={cliente.marca.logoAlt} width={180} height={40} className="h-10 w-auto" />
        </Link>
        <nav aria-label={t('principal')} className="flex items-center gap-1 sm:gap-2">
          <Link href="/eventos" className="rounded-md px-3 py-2.5 text-sm font-medium text-texto hover:bg-superficie-2">
            {t('eventos')}
          </Link>
          <Link href="/panel" className="rounded-md px-3 py-2.5 text-sm font-semibold text-marca hover:bg-superficie-2">
            {t('miPanel')}
          </Link>
          <SelectorIdioma />
        </nav>
      </div>
    </header>
  );
}
