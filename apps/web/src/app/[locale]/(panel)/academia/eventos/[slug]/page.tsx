import { estadoVentana, type ConceptoLinea, type Idioma, type ResultadoValidacion } from '@soed/domain';
import { Aviso, EncabezadoPagina, EstadoVacio, GrupoIndicadores, Indicador, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InsigniaVentana } from '@/components/insignia-ventana';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearDuracion, formatearMonto, formatearPuntaje, formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { moduloOn } from '@/lib/modulos';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { academiaActiva, inscripcionDeAcademia, listarCoreografias } from '@/modules/academias/infrastructure/consultas';
import {
  AccionesFicha,
  BotonInscribirAcademia,
  EmitirLiquidacion,
  FormularioFicha,
  FormularioRubros,
  FormularioSolicitud,
  InsigniaEstadoFicha,
  ListaInfracciones,
} from '@/modules/academias/interface/inscripcion';
import { clasesParaAcademia } from '@/modules/actividades/infrastructure/consultas';
import { SeccionClases } from '@/modules/actividades/interface/seccion-academia';
import { EnlacesCertificados } from '@/modules/documentos/interface/enlaces-certificados';
import { hotelesDeAcademia } from '@/modules/hoteles/infrastructure/consultas';
import { SeccionHoteles } from '@/modules/hoteles/interface/seccion-academia';
import { liquidacionPrevia } from '@/modules/liquidaciones/application/liquidaciones';
import { puertosLiquidacionSupabase } from '@/modules/liquidaciones/infrastructure/puertos-liquidacion-supabase';

export default async function InscripcionEvento({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale: Idioma = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const academia = academiaActiva(sesion);
  if (!academia) notFound();
  const datos = await inscripcionDeAcademia(db, slug, academia.id);
  if (!datos) notFound();
  const { evento, inscripcion, fichas, liquidacion, devoluciones, orden } = datos;
  const t = await getTranslations('academia.inscripcion');
  const te = await getTranslations('estados');
  const tev = await getTranslations('eventos');
  const tc = await getTranslations('comun');
  const defecto = evento.idioma_defecto as Idioma;
  const reglamento = evento.reglamento;
  const ventana = estadoVentana(
    { apertura: evento.inscripcion_apertura, cierre: evento.inscripcion_cierre, cierreModificaciones: evento.modificaciones_cierre },
    new Date(),
  );
  const modificable = ventana === 'ABIERTA' || ventana === 'SOLO_MODIFICACIONES';
  const monto = (centavos: number | null | undefined) => formatearMonto(Number(centavos ?? 0), evento.moneda, locale);

  const [coreografias, previa, hoteles, clases] = inscripcion
    ? await Promise.all([
        listarCoreografias(db, academia.id),
        liquidacionPrevia(puertosLiquidacionSupabase(db, sesion), inscripcion.id),
        moduloOn('hoteles') ? hotelesDeAcademia(db, evento.id, academia.id) : [],
        moduloOn('clases') ? clasesParaAcademia(db, evento.slug, evento.id, academia.id) : [],
      ])
    : [[], null, [], []];
  const inscriptas = new Set(fichas.map((f) => f.coreografiaId));
  const disponibles = coreografias
    .filter((c) => !inscriptas.has(c.id))
    .map((c) => ({ id: c.id, nombre: c.nombre, formacion: c.formacion }));
  const rubrosTarifario = (evento.tarifario as { rubros?: { codigo: string; nombre: unknown; precioUnitario: number }[] })?.rubros ?? [];
  const seleccionRubros = Object.fromEntries(
    ((inscripcion?.rubros as { codigo: string; cantidad: number }[]) ?? []).map((r) => [r.codigo, r.cantidad]),
  );
  const resultadosPublicados = evento.resultados_publicados_at !== null;

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={texto(evento.nombre, locale, defecto)}
        descripcion={`${formatearRangoFechas(evento.fecha_inicio, evento.fecha_fin, locale)} · ${academia.nombre}`}
        acciones={<InsigniaVentana ventana={ventana} />}
      />

      {!inscripcion ? (
        <Tarjeta className="flex flex-col gap-3">
          <p>{t('noInscripta')}</p>
          {ventana === 'ABIERTA' ? <BotonInscribirAcademia eventoId={evento.id} academiaId={academia.id} /> : null}
        </Tarjeta>
      ) : (
        <>
          <section className="flex flex-col gap-4" aria-labelledby="fichas">
            <h2 id="fichas" className="font-display text-xl font-bold">
              {t('fichas')}
            </h2>
            {ventana === 'ABIERTA' ? (
              <Tarjeta>
                <FormularioFicha eventoId={evento.id} academiaId={academia.id} coreografias={disponibles} reglamento={reglamento} />
              </Tarjeta>
            ) : null}
            {fichas.length === 0 ? <EstadoVacio titulo={t('sinFichas')} /> : null}
            <ul className="flex flex-col gap-3">
              {fichas.map((f) => {
                const v: ResultadoValidacion | null = f.validacion;
                return (
                  <li key={f.id}>
                    <Tarjeta className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                          <p className="font-display text-lg font-bold">{f.nombre}</p>
                          <p className="text-sm text-texto-suave">
                            {nombreCodigo(reglamento, 'generos', f.genero, locale)} ·{' '}
                            {nombreCodigo(reglamento, 'formaciones', f.formacion, locale)} · {t('categoria')}:{' '}
                            <strong className="text-texto">
                              {f.categoria ? nombreCodigo(reglamento, 'categorias', f.categoria, locale) : t('sinCategoria')}
                            </strong>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <InsigniaEstadoFicha estado={f.estado} />
                          {f.bloqueada ? <Insignia tono="alerta">{t('bloqueada')}</Insignia> : null}
                          {v?.valida ? <Insignia tono="exito">{t('valida')}</Insignia> : null}
                        </div>
                      </div>
                      {f.observacion ? (
                        <Aviso tono="alerta">
                          {f.observacion === 'REVALIDACION_REGLAMENTO'
                            ? t('observacionRevalidacion')
                            : t('observacion', { texto: f.observacion })}
                        </Aviso>
                      ) : null}
                      {v === null ? <p className="text-sm text-texto-suave">{t('sinValidar')}</p> : null}
                      {v && v.infracciones.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold">{t('infracciones')}</p>
                          <ListaInfracciones infracciones={v.infracciones} tono="error" />
                        </div>
                      ) : null}
                      {v && v.advertencias.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-sm font-semibold">{t('advertencias')}</p>
                          <ListaInfracciones infracciones={v.advertencias} tono="alerta" />
                        </div>
                      ) : null}
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">{t('elenco')}</summary>
                        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                          {f.elenco.map((b) => (
                            <li key={b.bailarinId} className="flex justify-between gap-2 rounded-md bg-superficie-2 px-3 py-1.5">
                              <span>{b.nombre}</span>
                              <span className="text-texto-suave">
                                {b.edad !== null ? t('anios', { edad: b.edad }) : null}
                                {b.categoria ? ` · ${nombreCodigo(reglamento, 'categorias', b.categoria, locale)}` : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {f.musicaDuracion && v?.tiempoMaximoSegundos ? (
                          <p className="mt-2 text-texto-suave">
                            {t('duracion')}: {formatearDuracion(f.musicaDuracion)} ·{' '}
                            {t('tiempoMaximo', { maximo: v.tiempoMaximoSegundos, tolerancia: v.toleranciaSegundos })}
                          </p>
                        ) : null}
                      </details>
                      <AccionesFicha fichaId={f.id} estado={f.estado} modificable={modificable && !f.bloqueada} />
                      {!modificable || f.bloqueada ? <FormularioSolicitud fichaId={f.id} /> : null}
                    </Tarjeta>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="flex flex-col gap-4" aria-labelledby="liquidacion">
            <h2 id="liquidacion" className="font-display text-xl font-bold">
              {t('liquidacion')}
            </h2>
            {previa && !previa.ok && previa.error.codigo === 'SIN_TARIFARIO' ? <Aviso tono="info">{t('sinTarifario')}</Aviso> : null}
            <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
              <Tarjeta className="flex flex-col gap-4">
                {previa?.ok ? (
                  <>
                    <GrupoIndicadores>
                      <Indicador etiqueta={t('totalEstimado')} valor={monto(previa.value.total)} detalle={t('totalEstimadoAyuda')} />
                    </GrupoIndicadores>
                    <Tabla>
                      <tbody>
                        {previa.value.lineas.map((l, i) => (
                          <tr key={`${l.concepto}-${l.referencia ?? ''}-${i}`}>
                            <Td>
                              {t(`conceptos.${l.concepto as ConceptoLinea}`)}
                              {l.cantidad > 1 ? ` × ${l.cantidad}` : null}
                              {l.referencia && fichas.find((f) => f.id === l.referencia) ? (
                                <span className="text-texto-suave"> · {fichas.find((f) => f.id === l.referencia)?.nombre}</span>
                              ) : null}
                            </Td>
                            <Td className="text-right tabular-nums">{monto(l.importe)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </Tabla>
                  </>
                ) : null}
                <FormularioRubros
                  inscripcionId={inscripcion.id}
                  seleccion={seleccionRubros}
                  rubros={rubrosTarifario.map((r) => ({
                    codigo: r.codigo,
                    nombre: texto(r.nombre, locale, defecto) || r.codigo,
                    precio: monto(r.precioUnitario),
                  }))}
                />
              </Tarjeta>
              <Tarjeta className="flex flex-col gap-3">
                {liquidacion?.version ? (
                  <>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                      <dt className="text-texto-suave">{t('numero')}</dt>
                      <dd className="text-right font-semibold tabular-nums">{liquidacion.numero}</dd>
                      <dt className="text-texto-suave">{t('version', { version: liquidacion.version })}</dt>
                      <dd className="text-right font-semibold tabular-nums">{monto(liquidacion.total_centavos)}</dd>
                      <dt className="text-texto-suave">{t('cobrado')}</dt>
                      <dd className="text-right tabular-nums">{monto(liquidacion.cobrado_centavos)}</dd>
                      <dt className="text-texto-suave">{t('saldo')}</dt>
                      <dd className="text-right font-bold tabular-nums">{monto(liquidacion.saldo_centavos)}</dd>
                    </dl>
                    <div>
                      <Insignia
                        tono={
                          liquidacion.estado === 'PAGADA' || liquidacion.estado === 'SIN_CARGO'
                            ? 'exito'
                            : liquidacion.estado === 'PARCIAL'
                              ? 'alerta'
                              : 'neutro'
                        }
                      >
                        {te(`liquidacion.${liquidacion.estado as 'PAGADA'}`)}
                      </Insignia>
                    </div>
                    <a
                      href={`/api/liquidaciones/${liquidacion.liquidacion_id}/pdf?idioma=${locale}`}
                      className="font-semibold text-marca underline-offset-4 hover:underline"
                    >
                      {t('descargarPdf')}
                    </a>
                  </>
                ) : null}
                <EmitirLiquidacion inscripcionId={inscripcion.id} />
                {texto(evento.datos_pago, locale, defecto) ? (
                  <div className="flex flex-col gap-1 text-sm">
                    <p className="font-semibold">{t('datosPago')}</p>
                    <p className="whitespace-pre-line">{texto(evento.datos_pago, locale, defecto)}</p>
                  </div>
                ) : null}
                <p className="text-xs text-texto-suave">{t('noEsFactura')}</p>
              </Tarjeta>
            </div>
          </section>

          <SeccionHoteles hoteles={hoteles} inscripcionId={inscripcion.id} moneda={evento.moneda} idioma={locale} defecto={defecto} />

          <SeccionClases clases={clases} eventoId={evento.id} zona={evento.zona_horaria} idioma={locale} defecto={defecto} />

          {orden.length > 0 ? (
            <section className="flex flex-col gap-3" aria-labelledby="orden">
              <h2 id="orden" className="font-display text-xl font-bold">
                {t('orden')}
              </h2>
              <Tabla>
                <thead>
                  <tr>
                    <Th>{tev('posicion')}</Th>
                    <Th>{tev('coreografia')}</Th>
                    <Th>{tc('estado')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {orden.map((o) => (
                    <tr key={o.ficha_id}>
                      <Td className="tabular-nums">{o.posicion}</Td>
                      <Td>
                        {fichas.find((f) => f.id === o.ficha_id)?.nombre}
                        <span className="text-texto-suave"> · {texto(o.bloque?.nombre, locale, defecto)}</span>
                      </Td>
                      <Td>{te(`orden.${o.estado as 'PROGRAMADA'}`)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Tabla>
            </section>
          ) : null}

          <section className="flex flex-col gap-3" aria-labelledby="resultados">
            <h2 id="resultados" className="font-display text-xl font-bold">
              {t('resultados')}
            </h2>
            {!resultadosPublicados || devoluciones.length === 0 ? <p className="text-texto-suave">{t('sinDevoluciones')}</p> : null}
            {resultadosPublicados && devoluciones.length > 0 ? <EnlacesCertificados eventoId={evento.id} /> : null}
            {resultadosPublicados
              ? fichas
                  .filter((f) => devoluciones.some((d) => d.ficha_id === f.id))
                  .map((f) => (
                    <Tarjeta key={f.id} className="flex flex-col gap-3">
                      <p className="font-display font-bold">{f.nombre}</p>
                      <ul className="grid gap-3 md:grid-cols-3">
                        {devoluciones
                          .filter((d) => d.ficha_id === f.id)
                          .map((d) => (
                            <li key={d.jurado_numero} className="flex flex-col gap-1 rounded-md bg-superficie-2 p-3 text-sm">
                              <p className="font-semibold">
                                {t('jurado', { numero: d.jurado_numero ?? 0 })} · {formatearPuntaje(Number(d.total ?? 0), locale)}
                              </p>
                              {d.comentario ? <p className="whitespace-pre-line">{d.comentario}</p> : null}
                            </li>
                          ))}
                      </ul>
                    </Tarjeta>
                  ))
              : null}
          </section>
        </>
      )}
    </div>
  );
}
