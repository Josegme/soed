import { detectarDesvios, type Idioma } from '@soed/domain';
import { CampoTexto, EncabezadoPagina, EstadoVacio, Insignia, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { EnVivo } from '@/components/en-vivo';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearPuntaje } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { reabrirPlanillaAccion } from '@/modules/puntajes/interface/acciones';
import { juradosDelEvento, planillasDelEvento } from '@/modules/vivo/infrastructure/consultas';
import { contextoVivo } from '@/modules/vivo/interface/contexto';
import { SelectorPista } from '@/modules/vivo/interface/selector-pista';

/** Supervisión del jurado en vivo (OP-03, JU-07): planillas recibidas, desvíos y reapertura. */
export default async function DirectorTecnico({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ pista?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, pistas, pista, items, realtime } = await contextoVivo(eventoId, 'puntajes.supervisar', (await searchParams).pista);
  const [planillas, miembros] = await Promise.all([planillasDelEvento(db, eventoId), juradosDelEvento(db, eventoId)]);
  const t = await getTranslations('vivo');
  const tp = await getTranslations('estados.planilla');
  const tc = await getTranslations('comun');
  const jurados = [...new Set([...miembros, ...planillas.map((p) => p.jurado_id)])].sort();
  const decimales = evento.reglamento.puntaje?.decimalesResultado ?? 2;
  const visibles = items.filter((i) => i.estado !== 'PROGRAMADA' && i.estado !== 'AUSENTE');

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('directorTecnico.titulo')}
        descripcion={texto(evento.nombre, idioma, evento.defecto)}
        acciones={<EnVivo {...realtime} eventoId={eventoId} tablas={['orden_item', 'planilla']} />}
      />
      <SelectorPista
        pistas={pistas}
        actual={pista?.id}
        ruta={`/vivo/${eventoId}/director-tecnico`}
        idioma={idioma}
        defecto={evento.defecto}
        etiqueta={t('pistas')}
      />
      {visibles.length === 0 || jurados.length === 0 ? (
        <EstadoVacio titulo={t('directorTecnico.sinActividad')} />
      ) : (
        <Tabla>
          <caption className="sr-only">{t('directorTecnico.titulo')}</caption>
          <thead>
            <tr>
              <Th scope="col">{t('directorTecnico.coreografia')}</Th>
              {jurados.map((j, n) => (
                <Th key={j} scope="col" className="text-center">
                  {t('directorTecnico.jurado', { numero: n + 1 })}
                </Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...visibles].reverse().map((i) => {
              const deFicha = planillas.filter((p) => p.ficha_id === i.fichaId);
              const desvios = new Set(
                detectarDesvios(
                  deFicha
                    .filter((p) => p.estado === 'ENVIADA' && p.total !== null)
                    .map((p) => ({ juradoId: p.jurado_id, total: p.total! })),
                  evento.reglamento.puntaje?.umbralDesvio ?? 1.5,
                ).map((d) => d.juradoId),
              );
              return (
                <tr key={i.id} className="border-t border-borde align-top">
                  <Td>
                    <span className="font-semibold">
                      {i.posicion}. {i.nombre}
                    </span>
                    <span className="block text-xs text-texto-suave">{i.academia}</span>
                  </Td>
                  {jurados.map((j) => {
                    const p = deFicha.find((x) => x.jurado_id === j);
                    return (
                      <Td key={j} className={`text-center ${desvios.has(j) ? 'bg-alerta/10' : ''}`}>
                        {!p ? (
                          <span className="text-texto-suave">{t('directorTecnico.sinPlanilla')}</span>
                        ) : (
                          <span className="inline-flex flex-col items-center gap-1">
                            <Insignia tono={p.estado === 'ENVIADA' ? 'exito' : p.estado === 'REABIERTA' ? 'alerta' : 'neutro'}>
                              {tp(p.estado as 'ENVIADA')}
                            </Insignia>
                            {/* Solo el total de una planilla enviada: el de un borrador es parcial y confunde. */}
                            {p.estado === 'ENVIADA' && p.total !== null ? (
                              <span className="font-semibold tabular-nums">{formatearPuntaje(p.total, idioma, decimales)}</span>
                            ) : null}
                            {desvios.has(j) ? <span className="text-xs font-medium text-alerta">{t('directorTecnico.desvio')}</span> : null}
                            {p.estado === 'ENVIADA' ? (
                              <details className="text-left">
                                <summary className="cursor-pointer text-xs font-medium text-marca">{t('directorTecnico.reabrir')}</summary>
                                <FormularioAccion
                                  accion={reabrirPlanillaAccion}
                                  namespace="gestion.puntajes"
                                  boton={t('directorTecnico.reabrir')}
                                  tamano="chico"
                                  variante="secundario"
                                  className="mt-2 min-w-48"
                                >
                                  <input type="hidden" name="planillaId" value={p.id} />
                                  <CampoTexto name="motivo" etiqueta={tc('motivo')} requerido textoRequerido={tc('requerido')} />
                                </FormularioAccion>
                              </details>
                            ) : null}
                          </span>
                        )}
                      </Td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </Tabla>
      )}
    </div>
  );
}
