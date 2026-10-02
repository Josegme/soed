import type { Idioma } from '@soed/domain';
import { getTranslations } from 'next-intl/server';
import { EnVivo } from '@/components/en-vivo';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { secuencia, type ItemEnVivo } from '@/modules/vivo/infrastructure/consultas';
import { contextoVivo } from '@/modules/vivo/interface/contexto';
import { SelectorPista } from '@/modules/vivo/interface/selector-pista';

/**
 * Vista del locutor (OP-11, OP-12): tipografía grande sobre fondo oscuro de la
 * marca para leer a distancia y con poca luz; se actualiza sola.
 */
export default async function Locutor({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ pista?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { evento, pistas, pista, items, realtime } = await contextoVivo(eventoId, 'orden.ver', (await searchParams).pista);
  const t = await getTranslations('vivo');
  const { enEscena, llamada, proximas } = secuencia(items);
  const siguientes = proximas.filter((i) => i.id !== llamada?.id).slice(0, 6);
  const detalle = (i: ItemEnVivo) =>
    [
      i.academia,
      i.ciudad,
      i.categoria ? nombreCodigo(evento.reglamento, 'categorias', i.categoria, idioma) : null,
      nombreCodigo(evento.reglamento, 'formaciones', i.formacion, idioma),
      nombreCodigo(evento.reglamento, 'generos', i.genero, idioma),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100dvh-4rem)] flex-col gap-8 bg-marca px-4 py-8 text-marca-contraste sm:-mx-6 sm:px-8 lg:-mx-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">{t('locutor.titulo', { evento: texto(evento.nombre, idioma, evento.defecto) })}</h1>
        <div className="rounded-full bg-superficie px-3 py-1">
          <EnVivo {...realtime} eventoId={eventoId} tablas={['orden_item']} />
        </div>
      </div>
      <div className="rounded-[var(--radio)] bg-superficie p-2 text-texto empty:hidden">
        <SelectorPista
          pistas={pistas}
          actual={pista?.id}
          ruta={`/vivo/${eventoId}/locutor`}
          idioma={idioma}
          defecto={evento.defecto}
          etiqueta={t('pistas')}
        />
      </div>
      <section aria-labelledby="en-escena" className="flex flex-col gap-2">
        <h2 id="en-escena" className="text-sm font-semibold uppercase tracking-widest opacity-80">
          {t('enEscena')}
        </h2>
        {enEscena ? (
          <>
            <p className="font-display text-5xl font-bold leading-tight sm:text-6xl">{enEscena.nombre}</p>
            <p className="text-xl sm:text-2xl">{detalle(enEscena)}</p>
          </>
        ) : (
          <p className="text-2xl opacity-80">{t('nadie')}</p>
        )}
      </section>
      <section aria-labelledby="llamada" className="flex flex-col gap-1 border-t border-current/30 pt-6">
        <h2 id="llamada" className="text-sm font-semibold uppercase tracking-widest opacity-80">
          {t('llamada')}
        </h2>
        <p className="font-display text-3xl font-bold">{llamada?.nombre ?? t('nadie')}</p>
        {llamada ? <p className="text-lg">{detalle(llamada)}</p> : null}
      </section>
      <section aria-labelledby="proximas" className="flex flex-col gap-3 border-t border-current/30 pt-6">
        <h2 id="proximas" className="text-sm font-semibold uppercase tracking-widest opacity-80">
          {t('proximas')}
        </h2>
        <ol className="flex flex-col gap-3">
          {siguientes.map((i) => (
            <li key={i.id} className="flex gap-4 text-lg">
              <span className="w-8 shrink-0 text-right font-mono tabular-nums opacity-70">{i.posicion}</span>
              <span>
                <span className="font-semibold">{i.nombre}</span>
                <span className="block text-base opacity-80">{detalle(i)}</span>
              </span>
            </li>
          ))}
        </ol>
        {items.length > 0 && siguientes.length === 0 ? <p className="text-lg opacity-80">{t('locutor.finPista')}</p> : null}
      </section>
    </div>
  );
}
