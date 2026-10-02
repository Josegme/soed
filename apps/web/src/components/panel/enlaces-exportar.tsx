import { getLocale, getTranslations } from 'next-intl/server';

type TipoExportacion = 'fichas' | 'liquidaciones' | 'cobros' | 'resultados';

/** Descargas CSV del evento (OR-49): enlaces directos a la API, solo con `exportar.datos`. */
export async function EnlacesExportar({ eventoId, tipos }: { eventoId: string; tipos: readonly TipoExportacion[] }) {
  const t = await getTranslations('exportar');
  const locale = await getLocale();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-texto-suave">{t('titulo')}</span>
      {tipos.map((tipo) => (
        <a
          key={tipo}
          href={`/api/gestion/${eventoId}/exportar/${tipo}?idioma=${locale}`}
          download
          className="inline-flex min-h-9 items-center rounded-md border border-borde px-3 font-medium hover:bg-superficie-2"
        >
          {t(`tipos.${tipo}`)}
        </a>
      ))}
    </div>
  );
}
