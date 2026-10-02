import { estilosBoton } from '@soed/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NoEncontrado() {
  const t = useTranslations('noEncontrado');
  return (
    <main id="contenido" className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t('titulo')}</h1>
      <p className="text-texto-suave">{t('descripcion')}</p>
      <Link href="/" className={estilosBoton({ variante: 'primario' })}>
        {t('volver')}
      </Link>
    </main>
  );
}
