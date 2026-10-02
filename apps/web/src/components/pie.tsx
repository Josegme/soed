import { getTranslations } from 'next-intl/server';
import { cliente } from '@/cliente';
import { Link } from '@/i18n/navigation';

export async function Pie() {
  const t = await getTranslations('pie');
  const tl = await getTranslations('legal');
  return (
    <footer className="border-t border-borde bg-superficie">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-texto-suave sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{t('derechos', { anio: new Date().getFullYear(), razonSocial: cliente.nombre })}</p>
        <nav aria-label={t('contacto')} className="flex flex-wrap gap-4">
          <Link href="/legal/terminos" className="underline-offset-4 hover:underline">
            {tl('terminos')}
          </Link>
          <Link href="/legal/privacidad" className="underline-offset-4 hover:underline">
            {tl('privacidad')}
          </Link>
          <a href={`mailto:${cliente.legal.contactoEmail}`} className="underline-offset-4 hover:underline">
            {t('contacto')}
          </a>
        </nav>
        <p className="text-xs">{t('plataforma')}</p>
      </div>
    </footer>
  );
}
