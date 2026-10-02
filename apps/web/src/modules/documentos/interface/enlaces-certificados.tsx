import { getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { NOMBRE_IDIOMA } from '@/lib/i18n/locales';

/** Descarga de certificados en cada idioma de la instancia (OR-44, PR-32). */
export async function EnlacesCertificados({ eventoId }: { eventoId: string }) {
  const t = await getTranslations('certificado');
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-texto-suave">{t('descargar')}</span>
      {routing.locales.map((l) => (
        <a
          key={l}
          href={`/api/certificados/${eventoId}?idioma=${l}`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-9 items-center rounded-md border border-borde px-3 font-medium hover:bg-superficie-2"
        >
          {t('enIdioma', { idioma: NOMBRE_IDIOMA[l] })}
        </a>
      ))}
    </div>
  );
}
