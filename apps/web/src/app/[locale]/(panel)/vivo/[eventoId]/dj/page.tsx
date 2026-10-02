import type { Idioma } from '@soed/domain';
import { EncabezadoPagina, EstadoVacio, Insignia } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { EnVivo } from '@/components/en-vivo';
import { formatearDuracion } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { nombreArchivoSeguro } from '@/lib/zip/zip';
import { contextoVivo } from '@/modules/vivo/interface/contexto';
import { DescargaZip } from '@/modules/vivo/interface/descarga-zip';
import { SelectorPista } from '@/modules/vivo/interface/selector-pista';

/**
 * Música del evento para el DJ (OP-01 a OP-04): reproducción y descarga con
 * URLs firmadas de vida corta; el bucket es privado (TR-29).
 */
const extension = (ruta: string) => {
  const m = /\.[a-z0-9]{2,5}$/i.exec(ruta);
  return m ? m[0].toLowerCase() : '';
};

export default async function Dj({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ pista?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, pistas, pista, items, realtime } = await contextoVivo(eventoId, 'musica.descargar', (await searchParams).pista);
  const t = await getTranslations('vivo');
  const te = await getTranslations('estados.orden');
  const pendientes = items.filter((i) => i.estado !== 'PRESENTADA' && i.estado !== 'AUSENTE');
  // Se firman todas las músicas de la pista: el ZIP por bloque incluye también las ya presentadas.
  const rutas = items.map((i) => i.musicaPath).filter((r): r is string => !!r);
  const firmadas = new Map<string, string>();
  if (rutas.length > 0) {
    const { data } = await db.storage.from('musica').createSignedUrls(rutas, 60 * 60 * 3);
    for (const f of data ?? []) if (f.path && f.signedUrl) firmadas.set(f.path, f.signedUrl);
  }

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('dj.titulo')}
        descripcion={texto(evento.nombre, idioma, evento.defecto)}
        acciones={<EnVivo {...realtime} eventoId={eventoId} tablas={['orden_item']} />}
      />
      <SelectorPista
        pistas={pistas}
        actual={pista?.id}
        ruta={`/vivo/${eventoId}/dj`}
        idioma={idioma}
        defecto={evento.defecto}
        etiqueta={t('pistas')}
      />
      <p className="text-sm text-texto-suave">{t('dj.aclaracion')}</p>
      {pista && pista.bloques.some((b) => b.items.some((i) => i.musicaPath && firmadas.has(i.musicaPath))) ? (
        <section aria-labelledby="zip-bloques" className="flex flex-col gap-3 rounded-[var(--radio)] border border-borde bg-superficie p-4">
          <h2 id="zip-bloques" className="font-semibold">
            {t('dj.zipTitulo')}
          </h2>
          <ul className="flex flex-col gap-3">
            {pista.bloques.map((b) => {
              const archivos = b.items
                .filter((i) => i.musicaPath && firmadas.has(i.musicaPath))
                .map((i) => ({
                  nombre: `${nombreArchivoSeguro(`${String(i.posicion).padStart(3, '0')} - ${i.nombre} - ${i.academia}`)}${extension(i.musicaPath!)}`,
                  url: firmadas.get(i.musicaPath!)!,
                }));
              const nombreBloque = texto(b.nombre, idioma, evento.defecto);
              return archivos.length > 0 ? (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm">{t('dj.zipBloque', { bloque: nombreBloque, cantidad: archivos.length })}</span>
                  <DescargaZip
                    archivos={archivos}
                    nombreZip={`${nombreArchivoSeguro(`${texto(pista.nombre, idioma, evento.defecto)} - ${nombreBloque}`)}.zip`}
                    etiqueta={t('dj.zipDescargar', { bloque: nombreBloque })}
                    textos={{ preparando: t.raw('dj.zipPreparando') as string, listo: t('dj.zipListo'), error: t('dj.zipError') }}
                  />
                </li>
              ) : null;
            })}
          </ul>
        </section>
      ) : null}
      {pendientes.length === 0 ? (
        <EstadoVacio titulo={t('sinOrden')} />
      ) : (
        <ol className="flex flex-col gap-3">
          {pendientes.map((i) => {
            const url = i.musicaPath ? firmadas.get(i.musicaPath) : undefined;
            return (
              <li
                key={i.id}
                className={`flex flex-col gap-3 rounded-[var(--radio)] border bg-superficie p-4 ${i.estado === 'EN_ESCENA' ? 'border-acento ring-2 ring-acento/40' : 'border-borde'}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-8 text-right font-mono tabular-nums text-texto-suave">{i.posicion}</span>
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">{i.nombre}</p>
                    <p className="text-xs text-texto-suave">
                      {i.academia}
                      {i.duracion ? ` · ${formatearDuracion(i.duracion)}` : ''}
                    </p>
                  </div>
                  {i.estado !== 'PROGRAMADA' ? (
                    <Insignia tono={i.estado === 'EN_ESCENA' ? 'marca' : 'info'}>{te(i.estado as 'LLAMADA')}</Insignia>
                  ) : null}
                  {url ? (
                    <a href={url} download className="text-sm font-medium text-marca underline-offset-4 hover:underline">
                      {t('dj.descargar')}
                    </a>
                  ) : (
                    <Insignia tono="alerta">{i.musicaPath ? t('dj.noDisponible') : t('dj.sinMusica')}</Insignia>
                  )}
                </div>
                {url ? (
                  <audio
                    controls
                    preload={i.estado === 'PROGRAMADA' ? 'none' : 'auto'}
                    src={url}
                    className="w-full"
                    aria-label={t('dj.reproducir', { nombre: i.nombre })}
                  >
                    <track kind="captions" />
                  </audio>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
