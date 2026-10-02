import type { Idioma } from '@soed/domain';
import { EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { formatearFecha, formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { actividadesDeGestion } from '@/modules/actividades/infrastructure/consultas';
import { FormularioClase, FormularioEntrada } from '@/modules/actividades/interface/formularios';
import { TablaReservas } from '@/modules/actividades/interface/tabla-reservas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

/** Clases y entradas: catálogo, cupos, reservas y cobro manual (OR-51 a OR-53). */
export default async function ActividadesGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede, defecto } = await contextoGestion(eventoId, 'actividades');
  const { clases, entradas } = await actividadesDeGestion(db, eventoId);
  const t = await getTranslations('gestion.actividades');
  const configura = puede('evento.configurar');
  const cobra = puede('cobros.registrar');
  const zona = evento.zona_horaria;
  const monto = (c: number) => (c > 0 ? formatearMonto(c, evento.moneda, idioma) : t('gratis'));

  return (
    <div className="flex flex-col gap-8">
      <p className="max-w-prose text-sm text-texto-suave">{t('aclaracion')}</p>
      <section aria-labelledby="clases" className="flex flex-col gap-4">
        <h2 id="clases" className="font-display text-xl font-bold">
          {t('clases')}
        </h2>
        {clases.length === 0 ? <EstadoVacio titulo={t('sinClases')} /> : null}
        {clases.map((c) => (
          <Tarjeta key={c.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg font-bold">{texto(c.nombre, idioma, defecto)}</h3>
                <p className="text-sm text-texto-suave">
                  {formatearInstante(c.inicio, idioma, zona)} · {[c.docente, c.sala].filter(Boolean).join(' · ')}
                </p>
                <p className="text-sm">
                  {t('ocupacion', { ocupadas: c.ocupadas, cupo: c.cupo })} · {monto(c.precio)}
                </p>
              </div>
              <Insignia tono={c.publicada ? 'exito' : 'neutro'}>{c.publicada ? t('publicada') : t('borrador')}</Insignia>
            </div>
            <TablaReservas
              tipo="clase"
              reservas={c.reservas}
              titulo={texto(c.nombre, idioma, defecto)}
              idioma={idioma}
              zona={zona}
              puedeCobrar={cobra}
            />
            {configura ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{t('editar')}</summary>
                <FormularioClase eventoId={eventoId} zona={zona} moneda={evento.moneda} clase={c} />
              </details>
            ) : null}
          </Tarjeta>
        ))}
        {configura ? (
          <details className="rounded-[var(--radio)] border border-dashed border-borde p-4">
            <summary className="cursor-pointer font-medium">{t('nuevaClase')}</summary>
            <FormularioClase eventoId={eventoId} zona={zona} moneda={evento.moneda} />
          </details>
        ) : null}
      </section>

      <section aria-labelledby="entradas" className="flex flex-col gap-4">
        <h2 id="entradas" className="font-display text-xl font-bold">
          {t('entradas')}
        </h2>
        {entradas.length === 0 ? <EstadoVacio titulo={t('sinEntradas')} /> : null}
        {entradas.map((e) => (
          <Tarjeta key={e.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg font-bold">{texto(e.nombre, idioma, defecto)}</h3>
                <p className="text-sm">
                  {e.fecha ? `${formatearFecha(e.fecha, idioma)} · ` : ''}
                  {t('ocupacion', { ocupadas: e.ocupadas, cupo: e.cupo })} · {monto(e.precio)}
                </p>
              </div>
              <Insignia tono={e.publicada ? 'exito' : 'neutro'}>{e.publicada ? t('publicada') : t('borrador')}</Insignia>
            </div>
            <TablaReservas
              tipo="entrada"
              reservas={e.reservas}
              titulo={texto(e.nombre, idioma, defecto)}
              idioma={idioma}
              zona={zona}
              puedeCobrar={cobra}
            />
            {configura ? (
              <details>
                <summary className="cursor-pointer text-sm font-medium">{t('editar')}</summary>
                <FormularioEntrada eventoId={eventoId} moneda={evento.moneda} entrada={e} />
              </details>
            ) : null}
          </Tarjeta>
        ))}
        {configura ? (
          <details className="rounded-[var(--radio)] border border-dashed border-borde p-4">
            <summary className="cursor-pointer font-medium">{t('nuevaEntrada')}</summary>
            <FormularioEntrada eventoId={eventoId} moneda={evento.moneda} />
          </details>
        ) : null}
      </section>
    </div>
  );
}
