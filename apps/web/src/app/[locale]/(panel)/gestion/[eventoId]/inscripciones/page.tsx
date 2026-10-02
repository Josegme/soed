import type { Idioma } from '@soed/domain';
import { Aviso, CampoArea, CampoSelector, CampoTexto, EstadoVacio, estilosBoton, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearDuracion, formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo } from '@/lib/i18n/traducible';
import { InsigniaEstadoFicha, ListaInfracciones } from '@/modules/academias/interface/inscripcion';
import { academiasDelEvento, fichasDeGestion, solicitudesDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import { revalidarFichasEventoAccion } from '@/modules/eventos/interface/acciones';
import { gestionarFichaAccion, resolverSolicitudAccion } from '@/modules/inscripciones/interface/acciones-gestion';

const ESTADOS = ['BORRADOR', 'ENVIADA', 'OBSERVADA', 'APROBADA', 'RETIRADA'] as const;

/** Fichas del evento con filtros y acciones del organizador (OR-19 a OR-25). */
export default async function InscripcionesGestion({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ estado?: string; academia?: string; q?: string }>;
}) {
  const { locale, eventoId } = await params;
  const filtros = await searchParams;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede } = await contextoGestion(eventoId, 'inscripciones');
  const gestiona = puede('inscripciones.gestionar');
  const estado = ESTADOS.find((e) => e === filtros.estado);
  const [fichas, academias, solicitudes] = await Promise.all([
    fichasDeGestion(db, eventoId, { estado, academiaId: filtros.academia, q: filtros.q }),
    academiasDelEvento(db, eventoId),
    gestiona ? solicitudesDeGestion(db, eventoId) : Promise.resolve([]),
  ]);
  const t = await getTranslations('gestion.inscripciones');
  const te = await getTranslations('estados.ficha');
  const tc = await getTranslations('comun');
  const reglamento = evento.reglamentoTipado;
  const codigo = (tipo: 'generos' | 'formaciones' | 'categorias', c: string | null) =>
    c && reglamento ? nombreCodigo(reglamento, tipo, c, idioma) : (c ?? t('sinCategoria'));
  const pendientes = solicitudes.filter((s) => s.estado === 'PENDIENTE');

  return (
    <div className="flex flex-col gap-6">
      <form
        method="get"
        className="grid gap-3 rounded-[var(--radio)] border border-borde bg-superficie p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
      >
        <CampoTexto name="q" etiqueta={tc('buscar')} defaultValue={filtros.q ?? ''} />
        <CampoSelector
          name="estado"
          etiqueta={tc('estado')}
          vacio={t('todos')}
          defaultValue={estado ?? ''}
          opciones={ESTADOS.map((e) => ({ valor: e, etiqueta: te(e) }))}
        />
        <CampoSelector
          name="academia"
          etiqueta={t('academia')}
          vacio={t('todas')}
          defaultValue={filtros.academia ?? ''}
          opciones={academias.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
        />
        <button type="submit" className={estilosBoton({ variante: 'secundario' })}>
          {t('filtrar')}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-texto-suave" role="status">
          {t('resultado', { cantidad: fichas.length })}
        </p>
        {gestiona ? (
          <FormularioAccion
            accion={revalidarFichasEventoAccion}
            namespace="gestion.inscripciones"
            boton={t('revalidarTodas')}
            variante="secundario"
            tamano="chico"
            enLinea
          >
            <input type="hidden" name="eventoId" value={eventoId} />
          </FormularioAccion>
        ) : null}
      </div>

      {fichas.length === 0 ? <EstadoVacio titulo={t('sinFichas')} /> : null}
      <ul className="flex flex-col gap-3">
        {fichas.map((f) => (
          <li key={f.id}>
            <Tarjeta className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="font-display text-lg font-bold">{f.nombre}</p>
                  <p className="text-sm text-texto-suave">
                    {f.academia} · {codigo('generos', f.genero)} · {codigo('formaciones', f.formacion)} ·{' '}
                    {codigo('categorias', f.categoria)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <InsigniaEstadoFicha estado={f.estado} />
                  {f.valida === true ? <Insignia tono="exito">{t('cumple')}</Insignia> : null}
                  {f.valida === false ? <Insignia tono="error">{t('noCumple')}</Insignia> : null}
                  {f.excepcion ? <Insignia tono="info">{t('conExcepcion')}</Insignia> : null}
                  {f.bloqueada ? <Insignia tono="alerta">{t('bloqueada')}</Insignia> : null}
                  {!f.tieneMusica ? <Insignia tono="alerta">{t('sinMusica')}</Insignia> : null}
                </div>
              </div>
              {f.observacion ? <Aviso tono="alerta">{t('observacion', { texto: f.observacion })}</Aviso> : null}
              <ListaInfracciones infracciones={f.infracciones} tono="error" />
              <ListaInfracciones infracciones={f.advertencias} tono="alerta" />
              {f.excepcion ? (
                <p className="text-sm text-texto-suave">
                  {t('excepcionDetalle', {
                    motivo: f.excepcion.motivo,
                    fecha: formatearInstante(f.excepcion.at, idioma, evento.zona_horaria),
                  })}
                </p>
              ) : null}
              <details className="text-sm">
                <summary className="cursor-pointer font-medium">{t('elenco', { cantidad: f.elenco.length })}</summary>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  {f.elenco.map((b, i) => (
                    <li key={i} className="flex justify-between gap-2 rounded-md bg-superficie-2 px-3 py-1.5">
                      <span>{b.nombre}</span>
                      <span className="text-texto-suave">
                        {b.edad !== null ? t('anios', { edad: b.edad }) : null}
                        {b.categoria ? ` · ${codigo('categorias', b.categoria)}` : null}
                      </span>
                    </li>
                  ))}
                </ul>
                {f.duracion ? <p className="mt-2 text-texto-suave">{t('duracion', { duracion: formatearDuracion(f.duracion) })}</p> : null}
              </details>

              {gestiona && f.estado !== 'RETIRADA' ? (
                <div className="flex flex-col gap-3 border-t border-borde pt-3">
                  <div className="flex flex-wrap gap-2">
                    {f.estado !== 'APROBADA' && f.estado !== 'BORRADOR' ? (
                      <FormularioAccion
                        accion={gestionarFichaAccion}
                        namespace="gestion.inscripciones"
                        boton={t('aprobar')}
                        tamano="chico"
                        enLinea
                      >
                        <input type="hidden" name="accion" value="APROBAR" />
                        <input type="hidden" name="fichaId" value={f.id} />
                      </FormularioAccion>
                    ) : null}
                    <FormularioAccion
                      accion={gestionarFichaAccion}
                      namespace="gestion.inscripciones"
                      boton={f.bloqueada ? t('desbloquear') : t('bloquear')}
                      variante="secundario"
                      tamano="chico"
                      enLinea
                    >
                      <input type="hidden" name="accion" value="BLOQUEAR" />
                      <input type="hidden" name="fichaId" value={f.id} />
                      <input type="hidden" name="bloqueada" value={f.bloqueada ? 'false' : 'true'} />
                    </FormularioAccion>
                  </div>
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">{t('observar')}</summary>
                    <FormularioAccion
                      accion={gestionarFichaAccion}
                      namespace="gestion.inscripciones"
                      boton={t('enviarObservacion')}
                      variante="secundario"
                      tamano="chico"
                      className="mt-2"
                    >
                      <input type="hidden" name="accion" value="OBSERVAR" />
                      <input type="hidden" name="fichaId" value={f.id} />
                      <CampoArea
                        name="observacion"
                        etiqueta={t('textoObservacion')}
                        requerido
                        textoRequerido={tc('requerido')}
                        maxLength={2000}
                      />
                    </FormularioAccion>
                  </details>
                  {f.valida === false && !f.excepcion ? (
                    <details>
                      <summary className="cursor-pointer text-sm font-medium">{t('excepcion')}</summary>
                      <FormularioAccion
                        accion={gestionarFichaAccion}
                        namespace="gestion.inscripciones"
                        boton={t('registrarExcepcion')}
                        variante="secundario"
                        tamano="chico"
                        className="mt-2"
                      >
                        <input type="hidden" name="accion" value="EXCEPCION" />
                        <input type="hidden" name="fichaId" value={f.id} />
                        <CampoArea
                          name="motivo"
                          etiqueta={t('motivoExcepcion')}
                          ayuda={t('ayudaExcepcion')}
                          requerido
                          textoRequerido={tc('requerido')}
                          maxLength={1000}
                        />
                      </FormularioAccion>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </Tarjeta>
          </li>
        ))}
      </ul>

      {gestiona ? (
        <section id="solicitudes" aria-labelledby="titulo-solicitudes" className="flex flex-col gap-3">
          <h2 id="titulo-solicitudes" className="font-display text-xl font-bold">
            {t('solicitudes', { cantidad: pendientes.length })}
          </h2>
          {solicitudes.length === 0 ? <EstadoVacio titulo={t('sinSolicitudes')} /> : null}
          <ul className="flex flex-col gap-3">
            {solicitudes.map((s) => (
              <li key={s.id}>
                <Tarjeta className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{s.ficha?.nombre}</p>
                    <Insignia tono={s.estado === 'PENDIENTE' ? 'alerta' : s.estado === 'APROBADA' ? 'exito' : 'neutro'}>
                      {t(`solicitud.${s.estado as 'PENDIENTE' | 'APROBADA' | 'RECHAZADA'}`)}
                    </Insignia>
                  </div>
                  <p className="whitespace-pre-line text-sm">{s.descripcion}</p>
                  <p className="text-xs text-texto-suave">{formatearInstante(s.creado_at, idioma, evento.zona_horaria)}</p>
                  {s.respuesta ? <p className="text-sm text-texto-suave">{t('respuesta', { texto: s.respuesta })}</p> : null}
                  {s.estado === 'PENDIENTE' ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(['APROBADA', 'RECHAZADA'] as const).map((resolucion) => (
                        <FormularioAccion
                          key={resolucion}
                          accion={resolverSolicitudAccion}
                          namespace="gestion.inscripciones"
                          boton={t(`resolver.${resolucion}`)}
                          variante={resolucion === 'APROBADA' ? 'primario' : 'secundario'}
                          tamano="chico"
                        >
                          <input type="hidden" name="solicitudId" value={s.id} />
                          <input type="hidden" name="estado" value={resolucion} />
                          <CampoTexto name="respuesta" etiqueta={t('respuestaOpcional')} maxLength={4000} />
                        </FormularioAccion>
                      ))}
                    </div>
                  ) : null}
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
