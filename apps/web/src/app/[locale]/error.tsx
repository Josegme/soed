'use client';

import { Boton } from '@soed/ui';
import { useTranslations } from 'next-intl';

export default function ErrorPagina({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');
  return (
    <main id="contenido" role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="font-display text-3xl font-bold">{t('titulo')}</h1>
      <Boton onClick={reset}>{t('reintentar')}</Boton>
    </main>
  );
}
