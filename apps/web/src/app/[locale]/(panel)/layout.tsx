import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { cliente } from '@/cliente';
import { NavegacionPanel } from '@/components/panel/navegacion-panel';
import { SelectorIdioma } from '@/components/selector-idioma';
import { Link } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { cerrarSesion } from '@/modules/identidad/interface/acciones';
import { idiomaDe } from '@/lib/i18n/locales';

export default async function LayoutPanel({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const t = await getTranslations('panel');
  const tc = await getTranslations('comun');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-borde bg-superficie">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG de la instancia */}
            <img src={cliente.marca.logo} alt={cliente.marca.logoAlt} width={150} height={34} className="h-8 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-texto-suave sm:inline">{sesion.nombre || sesion.email}</span>
            <SelectorIdioma />
            <form action={cerrarSesion}>
              <button type="submit" className="min-h-11 rounded-md px-3 text-sm font-medium text-texto hover:bg-superficie-2">
                {tc('cerrarSesion')}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="border-b border-borde bg-superficie lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
          <details className="lg:hidden">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-semibold">{t('nav.titulo')}</summary>
            <div className="px-2 pb-4">
              <NavegacionPanel sesion={sesion} db={db} idioma={locale} />
            </div>
          </details>
          <div className="hidden p-3 lg:block">
            <NavegacionPanel sesion={sesion} db={db} idioma={locale} />
          </div>
        </aside>
        <main id="contenido" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
