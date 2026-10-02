import type { Idioma, ReglamentoEvento } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { CampoSelector, CampoTexto, EncabezadoPagina, EstadoVacio, estilosBoton, Tabla, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearPuntaje } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { etiquetaGrupo } from '@/modules/puntajes/interface/etiqueta-grupo';
import { historialDeTemporada } from '@/modules/temporadas/infrastructure/consultas';
import { EnlacesTemporada } from '@/modules/temporadas/interface/enlaces';

/** Historial de resultados y pases de academias y coreografías en la temporada (SA-15). */
export default async function HistorialTemporada({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; temporadaId: string }>;
  searchParams: Promise<{ q?: string; evento?: string }>;
}) {
  const { locale, temporadaId } = await params;
  if (!uuidSchema.safeParse(temporadaId).success) notFound();
  const filtros = await searchParams;
  const idioma: Idioma = idiomaDe(locale);
  const { db } = await requerirSesion();
  const eventoId = uuidSchema.safeParse(filtros.evento).success ? filtros.evento : undefined;
  const datos = await historialDeTemporada(db, temporadaId, { q: filtros.q, eventoId });
  if (!datos) notFound();
  const t = await getTranslations('admin.temporada');
  const tc = await getTranslations('comun');
  const { temporada, eventos, filas } = datos;
  const eventoPorId = new Map(eventos.map((e) => [e.id, e]));
  const nombreBanda = (reglamento: ReglamentoEvento | null, codigo: string, i: Idioma) =>
    texto(reglamento?.bandas.find((b) => b.codigo === codigo)?.nombre, i) || codigo;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('historialTitulo', { temporada: texto(temporada.nombre, idioma) })}
        descripcion={t('historialDescripcion')}
        acciones={<EnlacesTemporada temporadaId={temporadaId} actual="historial" />}
      />
      <form
        method="get"
        className="grid gap-3 rounded-[var(--radio)] border border-borde bg-superficie p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <CampoTexto name="q" etiqueta={tc('buscar')} ayuda={t('buscarAyuda')} defaultValue={filtros.q ?? ''} />
        <CampoSelector
          name="evento"
          etiqueta={t('evento')}
          vacio={t('todosLosEventos')}
          defaultValue={eventoId ?? ''}
          opciones={eventos.map((e) => ({ valor: e.id, etiqueta: texto(e.nombre, idioma, e.idioma_defecto as Idioma) }))}
        />
        <button type="submit" className={estilosBoton({ variante: 'secundario' })}>
          {t('filtrar')}
        </button>
      </form>
      <p className="text-sm text-texto-suave" role="status">
        {t('filas', { cantidad: filas.length })}
      </p>
      {filas.length === 0 ? (
        <EstadoVacio titulo={t('sinHistorial')} descripcion={t('sinHistorialDetalle')} />
      ) : (
        <Tabla>
          <caption className="sr-only">{t('historial')}</caption>
          <thead>
            <tr>
              <Th>{t('academia')}</Th>
              <Th>{t('coreografia')}</Th>
              <Th>{t('evento')}</Th>
              <Th>{t('grupo')}</Th>
              <Th className="text-right">{t('puesto')}</Th>
              <Th className="text-right">{t('puntaje')}</Th>
              <Th>{t('pases')}</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const evento = eventoPorId.get(f.eventoId);
              return (
                <tr key={`${f.eventoId}-${f.academiaId}-${f.coreografiaId}-${f.grupo}`}>
                  <Td className="font-medium">{f.academia}</Td>
                  <Td>{f.coreografia}</Td>
                  <Td>{evento?.slug}</Td>
                  <Td className="text-sm">{etiquetaGrupo(f.grupo, evento?.reglamento ?? null, idioma)}</Td>
                  <Td className="text-right tabular-nums">{f.puesto}</Td>
                  <Td className="text-right tabular-nums">
                    {formatearPuntaje(f.puntaje, idioma)}
                    {f.banda ? (
                      <span className="block text-xs text-texto-suave">{nombreBanda(evento?.reglamento ?? null, f.banda, idioma)}</span>
                    ) : null}
                  </Td>
                  <Td>{f.pases.length > 0 ? f.pases.join(' · ') : '—'}</Td>
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </div>
  );
}
