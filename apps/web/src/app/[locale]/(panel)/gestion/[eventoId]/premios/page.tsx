import type { Idioma, Moneda } from '@soed/domain';
import { Aviso, CampoSelector, CampoTexto, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { premiosDeGestion, puntajesDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import { asignarPremioAccion, crearPremioAccion, eliminarPremioAccion } from '@/modules/premios/interface/acciones';
import { etiquetaGrupo } from '@/modules/puntajes/interface/etiqueta-grupo';

/** Premios del evento (OR-10) y su asignación manual o por ranking (OR-43). La decisión final es de la organización. */
export default async function PremiosGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede, defecto } = await contextoGestion(eventoId, 'premios');
  const [{ premios, fichas }, puntajes] = await Promise.all([
    premiosDeGestion(db, eventoId),
    puede('puntajes.supervisar') ? puntajesDeGestion(db, eventoId) : null,
  ]);
  const t = await getTranslations('gestion.premios');
  const tc = await getTranslations('comun');
  const monto = (c: number | null) => (c === null ? t('sinMonto') : formatearMonto(c, evento.moneda as Moneda, idioma));
  const grupos = [...new Set((puntajes?.resultados ?? []).map((r) => r.grupo))].sort();
  const asigna = puede('premios.asignar');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
      <section aria-labelledby="titulo-premios" className="flex flex-col gap-3">
        <h2 id="titulo-premios" className="font-display text-xl font-bold">
          {t('titulo')}
        </h2>
        <Aviso tono="info">{t('aclaracion')}</Aviso>
        {premios.length === 0 ? <EstadoVacio titulo={t('sinPremios')} /> : null}
        <ul className="flex flex-col gap-3">
          {premios.map((p) => (
            <li key={p.id}>
              <Tarjeta className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-lg font-bold">{texto(p.nombre, idioma, defecto)}</p>
                    <p className="text-sm text-texto-suave">
                      {t(`tipos.${p.tipo as 'PRINCIPAL'}`)} · {monto(p.monto_centavos)} · {t(`reglas.${p.regla_empate as 'DIVIDIR_MONTO'}`)}
                      {p.criterio === 'RANKING'
                        ? ` · ${t('porRanking', { puesto: p.filtro.puesto ?? 1, grupo: p.filtro.grupo ? etiquetaGrupo(p.filtro.grupo, evento.reglamentoTipado, idioma) : t('todosLosGrupos') })}`
                        : ` · ${t('manual')}`}
                    </p>
                  </div>
                  {puede('evento.configurar') ? (
                    <FormularioAccion
                      accion={eliminarPremioAccion}
                      namespace="gestion.premios"
                      boton={tc('eliminar')}
                      variante="fantasma"
                      tamano="chico"
                      enLinea
                    >
                      <input type="hidden" name="premioId" value={p.id} />
                    </FormularioAccion>
                  ) : null}
                </div>
                {p.asignaciones.length > 0 ? (
                  <ul className="flex flex-col gap-1 text-sm">
                    {p.asignaciones.map((a) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-2 rounded-md bg-superficie-2 px-3 py-2">
                        <span>
                          <strong>{a.ficha}</strong> · {a.academia}
                        </span>
                        <Insignia tono="marca">{monto(a.monto_centavos)}</Insignia>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-texto-suave">{t('sinAsignar')}</p>
                )}
                {asigna ? (
                  p.criterio === 'RANKING' ? (
                    <FormularioAccion
                      accion={asignarPremioAccion}
                      namespace="gestion.premios"
                      boton={t('asignarRanking')}
                      variante="secundario"
                      tamano="chico"
                      enLinea
                    >
                      <input type="hidden" name="premioId" value={p.id} />
                    </FormularioAccion>
                  ) : (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium text-marca">{t('elegirGanadoras')}</summary>
                      <FormularioAccion
                        accion={asignarPremioAccion}
                        namespace="gestion.premios"
                        boton={t('asignar')}
                        tamano="chico"
                        className="mt-2"
                      >
                        <input type="hidden" name="premioId" value={p.id} />
                        <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                          <legend className="sr-only">{t('elegirGanadoras')}</legend>
                          {fichas.map((f) => (
                            <label key={f.id} className="flex min-h-11 items-center gap-3 text-sm">
                              <input
                                type="checkbox"
                                name="fichaId"
                                value={f.id}
                                defaultChecked={p.asignaciones.some((a) => a.ficha_id === f.id)}
                                className="size-5 accent-marca"
                              />
                              {f.nombre} · {f.academia}
                            </label>
                          ))}
                        </fieldset>
                      </FormularioAccion>
                    </details>
                  )
                ) : null}
              </Tarjeta>
            </li>
          ))}
        </ul>
      </section>
      {puede('evento.configurar') ? (
        <aside aria-labelledby="titulo-nuevo-premio">
          <Tarjeta className="flex flex-col gap-4">
            <h2 id="titulo-nuevo-premio" className="font-display text-lg font-bold">
              {t('nuevo')}
            </h2>
            <FormularioAccion accion={crearPremioAccion} namespace="gestion.premios" boton={tc('crear')}>
              <input type="hidden" name="eventoId" value={eventoId} />
              <CamposTraducibles
                nombre="nombre"
                etiqueta={tc('nombre')}
                requerido
                textoRequerido={tc('requerido')}
                maxLength={200}
                columnas={false}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoSelector
                  name="tipo"
                  etiqueta={t('tipo')}
                  opciones={(['PRINCIPAL', 'ESPECIAL'] as const).map((x) => ({ valor: x, etiqueta: t(`tipos.${x}`) }))}
                />
                <CampoTexto name="monto" etiqueta={t('monto', { moneda: evento.moneda })} ayuda={t('ayudaMonto')} inputMode="decimal" />
              </div>
              <CampoSelector
                name="criterio"
                etiqueta={t('criterio')}
                opciones={(['MANUAL', 'RANKING'] as const).map((x) => ({ valor: x, etiqueta: t(`criterios.${x}`) }))}
              />
              <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
                <CampoTexto name="puesto" type="number" min={1} etiqueta={t('puesto')} defaultValue="1" />
                <CampoSelector
                  name="grupo"
                  etiqueta={t('grupo')}
                  ayuda={t('ayudaGrupo')}
                  vacio={t('todosLosGrupos')}
                  opciones={grupos.map((g) => ({ valor: g, etiqueta: etiquetaGrupo(g, evento.reglamentoTipado, idioma) }))}
                />
              </div>
              <CampoSelector
                name="reglaEmpate"
                etiqueta={t('reglaEmpate')}
                opciones={(['DIVIDIR_MONTO', 'MONTO_COMPLETO_CADA_UNO'] as const).map((x) => ({ valor: x, etiqueta: t(`reglas.${x}`) }))}
              />
            </FormularioAccion>
          </Tarjeta>
        </aside>
      ) : null}
    </div>
  );
}
