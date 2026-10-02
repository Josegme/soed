import type { Idioma } from '@soed/domain';
import { CampoSelector, EstadoVacio, estilosBoton, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { etiquetaCodigo } from '@/lib/i18n/claves';
import { formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { auditoriaDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

const TABLAS = [
  'evento',
  'ficha',
  'inscripcion',
  'cobro',
  'liquidacion_version',
  'ajuste_liquidacion',
  'orden_item',
  'planilla',
  'resultado',
  'pase',
  'premio_asignacion',
  'evento_miembro',
  'credencial',
] as const;

/** Campos que cambiaron entre antes y después (sin volcar filas completas). */
function cambios(antes: unknown, despues: unknown): string[] {
  const a = (antes ?? {}) as Record<string, unknown>;
  const d = (despues ?? {}) as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(
    (k) => !['actualizado_at', 'creado_at'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(d[k]),
  );
}

/** Registro de auditoría del evento (OR-48, TR-30): quién cambió qué y cuándo. */
export default async function AuditoriaGestion({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ tabla?: string; pagina?: string }>;
}) {
  const { locale, eventoId } = await params;
  const filtros = await searchParams;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento } = await contextoGestion(eventoId, 'auditoria');
  const tabla = TABLAS.find((x) => x === filtros.tabla);
  const r = await auditoriaDeGestion(db, eventoId, { tabla, pagina: Number(filtros.pagina) || 1 });
  const t = await getTranslations('gestion.auditoria');
  const tc = await getTranslations('comun');
  const enlace = (pagina: number) =>
    `/gestion/${eventoId}/auditoria?${new URLSearchParams({ ...(tabla ? { tabla } : {}), pagina: String(pagina) })}`;

  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="flex flex-wrap items-end gap-3">
        <CampoSelector
          name="tabla"
          etiqueta={t('tabla')}
          vacio={t('todas')}
          defaultValue={tabla ?? ''}
          opciones={TABLAS.map((x) => ({ valor: x, etiqueta: t(`tablas.${x}`) }))}
        />
        <button type="submit" className={estilosBoton({ variante: 'secundario' })}>
          {t('filtrar')}
        </button>
      </form>
      <p className="text-sm text-texto-suave" role="status">
        {t('total', { cantidad: r.total })}
      </p>
      {r.filas.length === 0 ? (
        <EstadoVacio titulo={t('sinRegistros')} />
      ) : (
        <Tabla>
          <caption className="sr-only">{t('titulo')}</caption>
          <thead>
            <tr>
              <Th scope="col">{tc('fecha')}</Th>
              <Th scope="col">{t('usuario')}</Th>
              <Th scope="col">{t('tabla')}</Th>
              <Th scope="col">{t('accion')}</Th>
              <Th scope="col">{t('campos')}</Th>
            </tr>
          </thead>
          <tbody>
            {r.filas.map((f) => (
              <tr key={f.id} className="border-t border-borde align-top">
                <Td className="whitespace-nowrap">
                  {formatearInstante(f.ocurrido_at, idioma, evento.zona_horaria, { dateStyle: 'short', timeStyle: 'medium' })}
                </Td>
                <Td>{f.usuario ?? t('sistema')}</Td>
                <Td>{etiquetaCodigo(t, `tablas.${f.tabla}`).replace(/^tablas\./, '')}</Td>
                <Td>{t(`acciones.${f.accion as 'INSERT' | 'UPDATE' | 'DELETE'}`)}</Td>
                <Td className="font-mono text-xs">
                  {f.accion === 'UPDATE' ? cambios(f.antes, f.despues).join(', ') : (f.registro_id ?? '')}
                </Td>
              </tr>
            ))}
          </tbody>
        </Tabla>
      )}
      {r.paginas > 1 ? (
        <nav aria-label={t('paginacion')} className="flex items-center justify-between gap-3 text-sm">
          {r.pagina > 1 ? (
            <Link href={enlace(r.pagina - 1)} className={estilosBoton({ variante: 'secundario', tamano: 'chico' })}>
              {tc('anterior')}
            </Link>
          ) : (
            <span />
          )}
          <span>{t('pagina', { pagina: r.pagina, paginas: r.paginas })}</span>
          {r.pagina < r.paginas ? (
            <Link href={enlace(r.pagina + 1)} className={estilosBoton({ variante: 'secundario', tamano: 'chico' })}>
              {tc('siguiente')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
