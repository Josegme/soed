import type { Idioma, Moneda } from '@soed/domain';
import { CampoTexto, EstadoVacio, GrupoIndicadores, Indicador, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { etiquetaCodigo } from '@/lib/i18n/claves';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { resumenCaja } from '@/modules/cobros/application/cobros';
import { abrirTurnoAccion, anularCobroAccion, cerrarTurnoAccion } from '@/modules/cobros/interface/acciones';
import { TablaLiquidaciones } from '@/modules/cobros/interface/panel-cobros';
import { cobrosDeGestion, liquidacionesDeGestion, nombresDeUsuarios, turnosDeCaja } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

/** Cobranza del evento: saldos, cobros manuales, anulaciones y cierres de caja (OR-26 a OR-32). */
export default async function CobrosGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, sesion, evento, puede } = await contextoGestion(eventoId, 'cobros');
  const [liquidaciones, cobros, turnos] = await Promise.all([
    liquidacionesDeGestion(db, eventoId),
    cobrosDeGestion(db, eventoId),
    turnosDeCaja(db, eventoId),
  ]);
  const nombres = await nombresDeUsuarios(db, [...cobros.map((c) => c.registrado_por), ...turnos.map((x) => x.usuario_id)]);
  const t = await getTranslations('gestion.cobros');
  const tm = await getTranslations('medios');
  const tc = await getTranslations('comun');
  const moneda = evento.moneda as Moneda;
  const monto = (c: number) => formatearMonto(c, moneda, idioma);
  const esperado = liquidaciones.reduce((s, l) => s + l.total, 0);
  const cobrado = liquidaciones.reduce((s, l) => s + l.cobrado, 0);
  const caja = resumenCaja(
    cobros.map((c) => ({
      montoCentavos: Number(c.monto_centavos),
      medio: c.medio,
      registradoPor: c.registrado_por,
      anulado: c.anulado_at !== null,
    })),
  );
  const miTurno = turnos.find((x) => x.usuario_id === sesion.usuarioId && !x.cerrado_at);
  const academiaDe = new Map(liquidaciones.map((l) => [l.id, l.academia]));

  return (
    <div className="flex flex-col gap-8">
      <GrupoIndicadores className="sm:grid-cols-3">
        <Indicador etiqueta={t('esperado')} valor={monto(esperado)} />
        <Indicador etiqueta={t('cobrado')} valor={monto(cobrado)} detalle={t('cobros', { cantidad: caja.cantidad })} />
        <Indicador etiqueta={t('pendiente')} valor={monto(Math.max(0, esperado - cobrado))} />
      </GrupoIndicadores>
      <p className="text-sm text-texto-suave">{t('aclaracionManual')}</p>

      {puede('cobros.registrar') ? (
        <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            {miTurno
              ? t('turnoAbiertoDesde', { fecha: formatearInstante(miTurno.abierto_at, idioma, evento.zona_horaria) })
              : t('sinTurno')}
          </p>
          {!miTurno ? (
            <FormularioAccion
              accion={abrirTurnoAccion}
              namespace="gestion.cobros"
              boton={t('abrirTurno')}
              variante="secundario"
              tamano="chico"
              enLinea
            >
              <input type="hidden" name="eventoId" value={eventoId} />
            </FormularioAccion>
          ) : null}
        </Tarjeta>
      ) : null}

      <section aria-labelledby="titulo-liquidaciones" className="flex flex-col gap-3">
        <h2 id="titulo-liquidaciones" className="font-display text-xl font-bold">
          {t('liquidaciones')}
        </h2>
        <TablaLiquidaciones
          liquidaciones={liquidaciones}
          moneda={moneda}
          medios={evento.medios_cobro}
          idioma={idioma}
          puedeCobrar={puede('cobros.registrar')}
        />
      </section>

      <section aria-labelledby="titulo-caja" className="grid gap-4 lg:grid-cols-2">
        <h2 id="titulo-caja" className="sr-only">
          {t('caja')}
        </h2>
        <Tarjeta className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">{t('porMedio')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(caja.porMedio).map(([medio, total]) => (
              <li key={medio} className="flex justify-between">
                <span>{etiquetaCodigo(tm, medio)}</span>
                <span className="tabular-nums">{monto(total)}</span>
              </li>
            ))}
          </ul>
          {caja.anulados.cantidad > 0 ? (
            <p className="text-sm text-texto-suave">
              {t('anulados', { cantidad: caja.anulados.cantidad, monto: monto(caja.anulados.totalCentavos) })}
            </p>
          ) : null}
        </Tarjeta>
        <Tarjeta className="flex flex-col gap-3">
          <h3 className="font-display text-lg font-bold">{t('porPersona')}</h3>
          <ul className="flex flex-col gap-1 text-sm">
            {Object.entries(caja.porPersona).map(([persona, total]) => (
              <li key={persona} className="flex justify-between">
                <span>{nombres.get(persona) ?? persona.slice(0, 8)}</span>
                <span className="tabular-nums">{monto(total)}</span>
              </li>
            ))}
          </ul>
        </Tarjeta>
      </section>

      {turnos.length > 0 ? (
        <section aria-labelledby="titulo-turnos" className="flex flex-col gap-3">
          <h2 id="titulo-turnos" className="font-display text-xl font-bold">
            {t('turnos')}
          </h2>
          <ul className="flex flex-col gap-2">
            {turnos.map((x) => {
              const resumen = x.resumen as { total?: number; cobros?: number } | null;
              return (
                <li key={x.id}>
                  <Tarjeta className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="text-sm">
                      <p className="font-medium">{nombres.get(x.usuario_id) ?? x.usuario_id.slice(0, 8)}</p>
                      <p className="text-texto-suave">
                        {formatearInstante(x.abierto_at, idioma, evento.zona_horaria)}
                        {x.cerrado_at ? ` → ${formatearInstante(x.cerrado_at, idioma, evento.zona_horaria)}` : ''}
                      </p>
                    </div>
                    {x.cerrado_at ? (
                      <Insignia>{t('turnoCerradoResumen', { cobros: resumen?.cobros ?? 0, monto: monto(resumen?.total ?? 0) })}</Insignia>
                    ) : puede('caja.cerrar') ? (
                      <FormularioAccion
                        accion={cerrarTurnoAccion}
                        namespace="gestion.cobros"
                        boton={t('cerrarTurno')}
                        variante="secundario"
                        tamano="chico"
                        enLinea
                      >
                        <input type="hidden" name="turnoId" value={x.id} />
                      </FormularioAccion>
                    ) : (
                      <Insignia tono="info">{t('turnoAbierto')}</Insignia>
                    )}
                  </Tarjeta>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="titulo-cobros" className="flex flex-col gap-3">
        <h2 id="titulo-cobros" className="font-display text-xl font-bold">
          {t('historial')}
        </h2>
        {cobros.length === 0 ? (
          <EstadoVacio titulo={t('sinCobros')} />
        ) : (
          <Tabla>
            <caption className="sr-only">{t('historial')}</caption>
            <thead>
              <tr>
                <Th scope="col">{tc('fecha')}</Th>
                <Th scope="col">{t('academia')}</Th>
                <Th scope="col">{t('medio')}</Th>
                <Th scope="col" className="text-right">
                  {t('monto', { moneda })}
                </Th>
                <Th scope="col">{t('registradoPor')}</Th>
                <Th scope="col">{tc('estado')}</Th>
              </tr>
            </thead>
            <tbody>
              {cobros.map((c) => (
                <tr key={c.id} className="border-t border-borde align-top">
                  <Td className="whitespace-nowrap">{formatearInstante(c.registrado_at, idioma, evento.zona_horaria)}</Td>
                  <Td>
                    {academiaDe.get(c.liquidacion_id) ?? ''}
                    {c.referencia ? <span className="block text-xs text-texto-suave">{c.referencia}</span> : null}
                  </Td>
                  <Td>{etiquetaCodigo(tm, c.medio)}</Td>
                  <Td className={`text-right tabular-nums ${c.anulado_at ? 'line-through text-texto-suave' : ''}`}>
                    {monto(Number(c.monto_centavos))}
                  </Td>
                  <Td>{nombres.get(c.registrado_por) ?? ''}</Td>
                  <Td>
                    {c.anulado_at ? (
                      <span className="flex flex-col gap-1">
                        <Insignia tono="error">{t('anulado')}</Insignia>
                        <span className="text-xs text-texto-suave">{c.motivo_anulacion}</span>
                      </span>
                    ) : puede('cobros.anular') ? (
                      <details>
                        <summary className="cursor-pointer text-sm font-medium text-error">{t('anular')}</summary>
                        <FormularioAccion
                          accion={anularCobroAccion}
                          namespace="gestion.cobros"
                          boton={t('confirmarAnulacion')}
                          variante="peligro"
                          tamano="chico"
                          className="mt-2 min-w-56"
                        >
                          <input type="hidden" name="cobroId" value={c.id} />
                          <CampoTexto name="motivo" etiqueta={tc('motivo')} requerido textoRequerido={tc('requerido')} maxLength={500} />
                        </FormularioAccion>
                      </details>
                    ) : (
                      <Insignia tono="exito">{t('vigente')}</Insignia>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>
    </div>
  );
}
