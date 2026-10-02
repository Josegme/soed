import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Navegación entre tablero e historial y descargas CSV de la temporada (SA-18). */
export async function EnlacesTemporada({ temporadaId, actual }: { temporadaId: string; actual: 'tablero' | 'historial' | 'reglamento' }) {
  const t = await getTranslations('admin.temporada');
  const locale = await getLocale();
  const clase =
    'inline-flex min-h-9 items-center rounded-md border border-borde px-3 text-sm font-medium hover:bg-superficie-2 aria-[current=page]:bg-superficie-2';
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <nav aria-label={t('navegacion')} className="flex flex-wrap gap-2">
        <Link href="/admin" className={clase}>
          {t('volver')}
        </Link>
        <Link href={`/admin/temporadas/${temporadaId}`} aria-current={actual === 'tablero' ? 'page' : undefined} className={clase}>
          {t('tablero')}
        </Link>
        <Link
          href={`/admin/temporadas/${temporadaId}/historial`}
          aria-current={actual === 'historial' ? 'page' : undefined}
          className={clase}
        >
          {t('historial')}
        </Link>
        <Link
          href={`/admin/temporadas/${temporadaId}/reglamento`}
          aria-current={actual === 'reglamento' ? 'page' : undefined}
          className={clase}
        >
          {t('reglamento')}
        </Link>
      </nav>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-texto-suave">{t('exportar')}</span>
        {(['eventos', 'historial'] as const).map((tipo) => (
          <a key={tipo} href={`/api/admin/temporadas/${temporadaId}/exportar/${tipo}?idioma=${locale}`} download className={clase}>
            {t(`tiposExportacion.${tipo}`)}
          </a>
        ))}
      </div>
    </div>
  );
}
