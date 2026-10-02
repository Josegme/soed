import type { Idioma, Moneda } from '@soed/domain';
import { Aviso, CampoArea, CampoSelector, CampoTexto, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { academiasDelEvento, coreografiasDelEvento, pasesDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import { anularPaseAccion, registrarPaseAccion } from '@/modules/pases/interface/acciones';

/** Pases manuales a la final u otro evento de la temporada (OR-33, OR-34). El sistema registra; decide la organización. */
export default async function PasesGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, defecto } = await contextoGestion(eventoId, 'pases');
  const [{ pases, destinos }, academias, coreografias] = await Promise.all([
    pasesDeGestion(db, eventoId),
    academiasDelEvento(db, eventoId),
    coreografiasDelEvento(db, eventoId),
  ]);
  const t = await getTranslations('gestion.pases');
  const tc = await getTranslations('comun');
  const nombreDestino = new Map(destinos.map((d) => [d.id, texto(d.nombre, idioma, defecto)]));
  const academia = new Map(academias.map((a) => [a.id, a.nombre]));
  const beneficio = (b: unknown) => {
    const x = b as { tipo?: string; porcentaje?: number; montoCentavos?: number } | null;
    if (!x?.tipo) return null;
    if (x.tipo === 'DESCUENTO_PORCENTAJE') return t('beneficioPorcentaje', { porcentaje: x.porcentaje ?? 0 });
    if (x.tipo === 'DESCUENTO_MONTO')
      return t('beneficioMonto', { monto: formatearMonto(x.montoCentavos ?? 0, evento.moneda as Moneda, idioma) });
    return t('beca');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby="titulo-pases" className="flex flex-col gap-3">
        <h2 id="titulo-pases" className="font-display text-xl font-bold">
          {t('registrados', { cantidad: pases.filter((p) => !p.anulado_at).length })}
        </h2>
        <Aviso tono="info">{t('aclaracion')}</Aviso>
        {pases.length === 0 ? <EstadoVacio titulo={t('sinPases')} /> : null}
        <ul className="flex flex-col gap-3">
          {pases.map((p) => (
            <li key={p.id}>
              <Tarjeta className={`flex flex-col gap-2 ${p.anulado_at ? 'opacity-70' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {p.coreografia?.nombre ?? t('academiaCompleta')} · {p.academia?.nombre}
                  </p>
                  {p.anulado_at ? (
                    <Insignia tono="error">{t('anulado')}</Insignia>
                  ) : (
                    <Insignia tono="exito">{nombreDestino.get(p.evento_destino_id) ?? ''}</Insignia>
                  )}
                </div>
                <p className="text-sm">{p.motivo}</p>
                <p className="text-xs text-texto-suave">
                  {formatearInstante(p.registrado_at, idioma, evento.zona_horaria)}
                  {beneficio(p.beneficio) ? ` · ${beneficio(p.beneficio)}` : ''}
                </p>
                {p.anulado_at ? (
                  <p className="text-xs text-texto-suave">{t('motivoAnulacion', { motivo: p.motivo_anulacion ?? '' })}</p>
                ) : (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-error">{t('anular')}</summary>
                    <FormularioAccion
                      accion={anularPaseAccion}
                      namespace="gestion.pases"
                      boton={t('confirmarAnulacion')}
                      variante="peligro"
                      tamano="chico"
                      className="mt-2 max-w-sm"
                    >
                      <input type="hidden" name="paseId" value={p.id} />
                      <CampoTexto name="motivo" etiqueta={tc('motivo')} requerido textoRequerido={tc('requerido')} />
                    </FormularioAccion>
                  </details>
                )}
              </Tarjeta>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="titulo-nuevo-pase">
        <Tarjeta className="flex flex-col gap-4 lg:sticky lg:top-20">
          <h2 id="titulo-nuevo-pase" className="font-display text-lg font-bold">
            {t('nuevo')}
          </h2>
          {destinos.length === 0 ? (
            <Aviso tono="alerta">{t('sinDestinos')}</Aviso>
          ) : (
            <FormularioAccion accion={registrarPaseAccion} namespace="gestion.pases" boton={t('registrar')}>
              <input type="hidden" name="eventoOrigenId" value={eventoId} />
              <CampoSelector
                name="eventoDestinoId"
                etiqueta={t('destino')}
                requerido
                textoRequerido={tc('requerido')}
                opciones={destinos.map((d) => ({ valor: d.id, etiqueta: texto(d.nombre, idioma, defecto) }))}
              />
              <CampoSelector
                name="academiaId"
                etiqueta={t('academia')}
                requerido
                textoRequerido={tc('requerido')}
                vacio={tc('seleccionar')}
                opciones={academias.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
              />
              <CampoSelector
                name="coreografiaId"
                etiqueta={t('coreografia')}
                ayuda={t('ayudaCoreografia')}
                vacio={t('academiaCompleta')}
                opciones={coreografias.map((c) => ({
                  valor: c.coreografia_id,
                  etiqueta: `${c.nombre} · ${academia.get(c.academia_id) ?? ''}`,
                }))}
              />
              <CampoArea
                name="motivo"
                etiqueta={tc('motivo')}
                ayuda={t('ayudaMotivo')}
                requerido
                textoRequerido={tc('requerido')}
                maxLength={1000}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoSelector
                  name="beneficioTipo"
                  etiqueta={t('beneficio')}
                  vacio={tc('ninguno')}
                  opciones={[
                    { valor: 'DESCUENTO_PORCENTAJE', etiqueta: t('tipoPorcentaje') },
                    { valor: 'DESCUENTO_MONTO', etiqueta: t('tipoMonto') },
                    { valor: 'BECA', etiqueta: t('beca') },
                  ]}
                />
                <CampoTexto name="beneficioValor" etiqueta={t('valorBeneficio')} inputMode="decimal" />
              </div>
            </FormularioAccion>
          )}
        </Tarjeta>
      </aside>
    </div>
  );
}
