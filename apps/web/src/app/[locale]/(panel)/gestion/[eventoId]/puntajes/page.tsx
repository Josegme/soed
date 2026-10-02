import { banda, detectarDesvios, type Idioma } from '@soed/domain';
import { Aviso, CampoTexto, EstadoVacio, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { EnlacesExportar } from '@/components/panel/enlaces-exportar';
import { formatearInstante, formatearPuntaje } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { nombresDeUsuarios, puntajesDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import {
  calcularResultadosAccion,
  eliminarCriterioAccion,
  guardarCriterioAccion,
  publicarResultadosAccion,
  reabrirPlanillaAccion,
} from '@/modules/puntajes/interface/acciones';

/** Criterios, avance del jurado, desvíos, ranking y publicación (OR-40 a OR-45, Art. 32). */
export default async function PuntajesGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede, defecto } = await contextoGestion(eventoId, 'puntajes');
  const datos = await puntajesDeGestion(db, eventoId);
  const t = await getTranslations('gestion.puntajes');
  const tp = await getTranslations('estados.planilla');
  const tc = await getTranslations('comun');
  const reglamento = evento.reglamentoTipado;
  const esperados = Number((evento.config_operacion as { juradosPorFicha?: number }).juradosPorFicha ?? 3);
  const jurados = [...new Set(datos.planillas.map((p) => p.jurado_id))].sort();
  const nombres = await nombresDeUsuarios(db, jurados);
  const etiquetaJurado = (id: string) => nombres.get(id) || t('juradoNumero', { numero: jurados.indexOf(id) + 1 });
  const decimales = reglamento?.puntaje.decimalesResultado ?? 2;
  const nombreBanda = (codigo: string | null) => {
    const b = reglamento?.bandas.find((x) => x.codigo === codigo);
    return b ? texto(b.nombre, idioma, defecto) : null;
  };

  const avance = datos.fichas.map((f) => {
    const planillas = datos.planillas.filter((p) => p.ficha_id === f.id);
    const enviadas = planillas.filter((p) => p.estado === 'ENVIADA' && p.total !== null);
    const desvios = reglamento
      ? detectarDesvios(
          enviadas.map((p) => ({ juradoId: p.jurado_id, total: p.total! })),
          reglamento.puntaje.umbralDesvio,
        )
      : [];
    return { ficha: f, planillas, enviadas: enviadas.length, desvios };
  });
  const completas = avance.filter((a) => a.enviadas >= esperados).length;
  const conDesvio = avance.filter((a) => a.desvios.length > 0);
  const grupos = new Map<string, typeof datos.resultados>();
  for (const r of datos.resultados) grupos.set(r.grupo, [...(grupos.get(r.grupo) ?? []), r]);
  const etiquetaGrupo = (grupo: string) =>
    grupo
      .split('|')
      .map((c) => {
        if (!reglamento) return c;
        for (const tipo of ['categorias', 'formaciones', 'generos'] as const)
          if (reglamento[tipo].some((x) => x.codigo === c)) return nombreCodigo(reglamento, tipo, c, idioma);
        return c;
      })
      .join(' · ');

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="titulo-criterios" className="flex flex-col gap-3">
        <h2 id="titulo-criterios" className="font-display text-xl font-bold">
          {t('criterios')}
        </h2>
        {datos.criterios.length === 0 ? <Aviso tono="alerta">{t('sinCriterios')}</Aviso> : null}
        <ul className="flex flex-wrap gap-2">
          {datos.criterios.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-full border border-borde bg-superficie px-3 py-1 text-sm">
              <span>
                {texto(c.nombre, idioma, defecto)} <span className="text-texto-suave">{t('peso_valor', { peso: c.peso })}</span>
              </span>
              {puede('evento.configurar') ? (
                <FormularioAccion
                  accion={eliminarCriterioAccion}
                  namespace="gestion.puntajes"
                  boton={tc('quitar')}
                  variante="fantasma"
                  tamano="chico"
                  enLinea
                >
                  <input type="hidden" name="criterioId" value={c.id} />
                </FormularioAccion>
              ) : null}
            </li>
          ))}
        </ul>
        {puede('evento.configurar') ? (
          <details>
            <summary className="cursor-pointer text-sm font-medium text-marca">{t('nuevoCriterio')}</summary>
            <FormularioAccion
              accion={guardarCriterioAccion}
              namespace="gestion.puntajes"
              boton={tc('guardar')}
              variante="secundario"
              className="mt-3 max-w-2xl"
            >
              <input type="hidden" name="eventoId" value={eventoId} />
              <div className="grid gap-3 sm:grid-cols-[12rem_8rem]">
                <CampoTexto
                  name="codigo"
                  etiqueta={t('codigo')}
                  ayuda={t('ayudaCodigo')}
                  requerido
                  textoRequerido={tc('requerido')}
                  maxLength={40}
                />
                <CampoTexto name="peso" etiqueta={t('peso')} inputMode="decimal" defaultValue="1" />
              </div>
              <CamposTraducibles nombre="nombre" etiqueta={tc('nombre')} requerido textoRequerido={tc('requerido')} maxLength={120} />
            </FormularioAccion>
          </details>
        ) : null}
      </section>

      <section aria-labelledby="titulo-avance" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-avance" className="font-display text-xl font-bold">
              {t('avance')}
            </h2>
            <p className="text-sm text-texto-suave">{t('avanceDetalle', { completas, total: avance.length, esperados })}</p>
          </div>
          <FormularioAccion accion={calcularResultadosAccion} namespace="gestion.puntajes" boton={t('calcular')} tamano="chico" enLinea>
            <input type="hidden" name="eventoId" value={eventoId} />
          </FormularioAccion>
        </div>
        {conDesvio.length > 0 ? (
          <Aviso tono="alerta" titulo={t('desvios', { cantidad: conDesvio.length })}>
            <ul className="list-disc pl-5">
              {conDesvio.map((a) => (
                <li key={a.ficha.id}>
                  {t('desvioDetalle', {
                    ficha: a.ficha.nombre,
                    detalle: a.desvios
                      .map((d) =>
                        t('desvioJurado', {
                          jurado: etiquetaJurado(d.juradoId),
                          diferencia: formatearPuntaje(d.diferencia, idioma, decimales, true),
                        }),
                      )
                      .join(' · '),
                  })}
                </li>
              ))}
            </ul>
          </Aviso>
        ) : null}
        {avance.length === 0 ? (
          <EstadoVacio titulo={t('sinFichas')} />
        ) : (
          <details>
            <summary className="cursor-pointer text-sm font-medium">{t('verPlanillas')}</summary>
            <Tabla className="mt-3">
              <caption className="sr-only">{t('avance')}</caption>
              <thead>
                <tr>
                  <Th scope="col">{t('ficha')}</Th>
                  <Th scope="col">{t('enviadas')}</Th>
                  <Th scope="col">{t('planillas')}</Th>
                </tr>
              </thead>
              <tbody>
                {avance.map((a) => (
                  <tr key={a.ficha.id} className="border-t border-borde align-top">
                    <Td>
                      <span className="font-medium">{a.ficha.nombre}</span>
                      <span className="block text-xs text-texto-suave">{a.ficha.academia}</span>
                    </Td>
                    <Td className="tabular-nums">
                      <Insignia tono={a.enviadas >= esperados ? 'exito' : 'neutro'}>
                        {t('fraccion', { enviadas: a.enviadas, esperados })}
                      </Insignia>
                    </Td>
                    <Td>
                      <ul className="flex flex-col gap-1">
                        {a.planillas.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                            <span>{etiquetaJurado(p.jurado_id)}</span>
                            <Insignia tono={p.estado === 'ENVIADA' ? 'exito' : p.estado === 'REABIERTA' ? 'alerta' : 'neutro'}>
                              {tp(p.estado as 'ENVIADA')}
                            </Insignia>
                            {p.total !== null ? <span className="tabular-nums">{formatearPuntaje(p.total, idioma, decimales)}</span> : null}
                            {p.estado === 'ENVIADA' ? (
                              <details>
                                <summary className="cursor-pointer text-xs font-medium text-marca">{t('reabrir')}</summary>
                                <FormularioAccion
                                  accion={reabrirPlanillaAccion}
                                  namespace="gestion.puntajes"
                                  boton={t('confirmarReabrir')}
                                  variante="secundario"
                                  tamano="chico"
                                  className="mt-2 min-w-56"
                                >
                                  <input type="hidden" name="planillaId" value={p.id} />
                                  <CampoTexto name="motivo" etiqueta={tc('motivo')} requerido textoRequerido={tc('requerido')} />
                                </FormularioAccion>
                              </details>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </details>
        )}
      </section>

      <section aria-labelledby="titulo-resultados" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-resultados" className="font-display text-xl font-bold">
              {t('resultados')}
            </h2>
            <p className="text-sm text-texto-suave">
              {evento.resultados_publicados_at
                ? t('publicadosDesde', { fecha: formatearInstante(evento.resultados_publicados_at, idioma, evento.zona_horaria) })
                : t('sinPublicar')}
            </p>
          </div>
          {puede('resultados.publicar') && (datos.resultados.length > 0 || evento.resultados_publicados_at) ? (
            <FormularioAccion
              accion={publicarResultadosAccion}
              namespace="gestion.puntajes"
              boton={evento.resultados_publicados_at ? t('retirar') : t('publicar')}
              variante={evento.resultados_publicados_at ? 'secundario' : 'acento'}
              tamano="chico"
              enLinea
            >
              <input type="hidden" name="eventoId" value={eventoId} />
              <input type="hidden" name="publicar" value={evento.resultados_publicados_at ? 'false' : 'true'} />
            </FormularioAccion>
          ) : null}
        </div>
        <p className="text-sm text-texto-suave">{t('aclaracionPases')}</p>
        {puede('exportar.datos') && datos.resultados.length > 0 ? <EnlacesExportar eventoId={eventoId} tipos={['resultados']} /> : null}
        {datos.resultados.length === 0 ? <EstadoVacio titulo={t('sinResultados')} /> : null}
        {[...grupos.entries()].map(([grupo, filas]) => (
          <Tarjeta key={grupo} className="flex flex-col gap-2 p-4">
            <h3 className="font-semibold">{etiquetaGrupo(grupo)}</h3>
            <ol className="flex flex-col gap-1">
              {filas.map((r) => {
                const nombre =
                  nombreBanda(r.banda) ?? (reglamento ? nombreBanda(banda(r.puntaje, reglamento.bandas)?.codigo ?? null) : null);
                return (
                  <li key={r.ficha_id} className="grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-3 text-sm">
                    <span className="font-display text-lg font-bold tabular-nums">{r.puesto}</span>
                    <span>
                      <span className="font-medium">{r.ficha}</span>
                      <span className="block text-xs text-texto-suave">{r.academia}</span>
                    </span>
                    {nombre ? <Insignia tono="marca">{nombre}</Insignia> : <span />}
                    <span className="font-semibold tabular-nums">{formatearPuntaje(r.puntaje, idioma, decimales)}</span>
                  </li>
                );
              })}
            </ol>
          </Tarjeta>
        ))}
      </section>
    </div>
  );
}
