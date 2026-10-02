import { ESTADOS_ORDEN, transicionEstado, type EstadoOrden, type Idioma } from '@soed/domain';
import { EncabezadoPagina, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { EnVivo } from '@/components/en-vivo';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearDuracion } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { avanzarOrdenAccion, cambiarEstadoOrdenAccion } from '@/modules/orden/interface/acciones';
import { secuencia } from '@/modules/vivo/infrastructure/consultas';
import { contextoVivo } from '@/modules/vivo/interface/contexto';
import { SelectorPista } from '@/modules/vivo/interface/selector-pista';

const TONO: Record<string, 'neutro' | 'info' | 'alerta' | 'exito' | 'error' | 'marca'> = {
  PROGRAMADA: 'neutro',
  LLAMADA: 'info',
  EN_ESCENA: 'marca',
  PRESENTADA: 'exito',
  AUSENTE: 'error',
};

/** Coordinación en vivo (OP-05 a OP-10): "Siguiente" y estados por coreografía, en tiempo real. */
export default async function Coordinador({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ pista?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { evento, pistas, pista, items, realtime } = await contextoVivo(eventoId, 'orden.operar', (await searchParams).pista);
  const t = await getTranslations('vivo');
  const te = await getTranslations('estados.orden');
  const { enEscena, llamada } = secuencia(items);
  const codigo = (tipo: 'categorias' | 'formaciones' | 'generos', c: string | null) =>
    c ? nombreCodigo(evento.reglamento, tipo, c, idioma) : '';
  const destinos = (desde: EstadoOrden) => ESTADOS_ORDEN.filter((h) => h !== desde && transicionEstado(desde, h).ok);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('coordinador.titulo')}
        descripcion={texto(evento.nombre, idioma, evento.defecto)}
        acciones={<EnVivo {...realtime} eventoId={eventoId} tablas={['orden_item']} />}
      />
      <SelectorPista
        pistas={pistas}
        actual={pista?.id}
        ruta={`/vivo/${eventoId}/coordinador`}
        idioma={idioma}
        defecto={evento.defecto}
        etiqueta={t('pistas')}
      />
      {!pista || items.length === 0 ? (
        <EstadoVacio titulo={t('sinOrden')} />
      ) : (
        <>
          <Tarjeta className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{t('enEscena')}</p>
              <p className="font-display text-2xl font-bold">{enEscena?.nombre ?? t('nadie')}</p>
              {enEscena ? <p className="text-sm text-texto-suave">{enEscena.academia}</p> : null}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-suave">{t('llamada')}</p>
              <p className="font-display text-xl font-bold">{llamada?.nombre ?? t('nadie')}</p>
              {llamada ? <p className="text-sm text-texto-suave">{llamada.academia}</p> : null}
            </div>
            <FormularioAccion accion={avanzarOrdenAccion} namespace="vivo" boton={t('coordinador.siguiente')} variante="acento" enLinea>
              <input type="hidden" name="pistaId" value={pista.id} />
            </FormularioAccion>
          </Tarjeta>
          {pista.bloques.map((b) => (
            <section key={b.id} aria-labelledby={`bloque-${b.id}`} className="flex flex-col gap-2">
              <h2 id={`bloque-${b.id}`} className="font-display text-lg font-bold">
                {texto(b.nombre, idioma, evento.defecto)}
              </h2>
              <ol className="flex flex-col divide-y divide-borde rounded-[var(--radio)] border border-borde bg-superficie">
                {b.items.map((i) => (
                  <li
                    key={i.id}
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i.estado === 'EN_ESCENA' ? 'bg-acento/10' : ''}`}
                  >
                    <span className="w-8 text-right font-mono tabular-nums text-texto-suave">{i.posicion}</span>
                    <div className="min-w-48 flex-1">
                      <p className="font-semibold">{i.nombre}</p>
                      <p className="text-xs text-texto-suave">
                        {i.academia} · {codigo('categorias', i.categoria)} · {codigo('formaciones', i.formacion)}
                        {i.duracion ? ` · ${formatearDuracion(i.duracion)}` : ''}
                      </p>
                    </div>
                    <Insignia tono={TONO[i.estado]}>{te(i.estado as EstadoOrden)}</Insignia>
                    <FormularioAccion
                      accion={cambiarEstadoOrdenAccion}
                      namespace="vivo"
                      nombreBoton="estado"
                      tamano="chico"
                      variante="secundario"
                      enLinea
                      botones={destinos(i.estado as EstadoOrden).map((d) => ({ valor: d, etiqueta: t(`coordinador.pasarA.${d}`) }))}
                    >
                      <input type="hidden" name="itemId" value={i.id} />
                    </FormularioAccion>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
