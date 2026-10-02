'use client';

import type { Idioma } from '@soed/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { NOMBRE_IDIOMA } from '@/lib/i18n/locales';

/** Selector de idioma visible (PU-01): conserva la ruta actual. */
export function SelectorIdioma() {
  const t = useTranslations('comun');
  const locale = useLocale() as Idioma;
  const router = useRouter();
  const pathname = usePathname();
  const [pendiente, iniciar] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('cambiarIdioma')}</span>
      <select
        value={locale}
        disabled={pendiente}
        onChange={(e) => iniciar(() => router.replace(pathname, { locale: e.target.value as Idioma }))}
        className="min-h-11 rounded-[var(--radio)] border border-borde bg-superficie px-2 text-sm text-texto focus-visible:ring-[3px] focus-visible:ring-marca/60"
      >
        {routing.locales.map((l) => (
          <option key={l} value={l}>
            {NOMBRE_IDIOMA[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
