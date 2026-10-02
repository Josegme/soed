import {
  MEDIOS_COBRO_DEFECTO,
  TIPOS_CREDENCIAL,
  transicionesPosibles,
  type ConfigAcreditacion,
  type EstadoEvento,
  type Idioma,
  type Traducible,
} from '@soed/domain';
import { Aviso, CampoArea, CampoSelector, CampoTexto, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { AMBITOS_CAMPO, leerCamposAdicionales } from '@soed/shared-types';
import { cliente } from '@/cliente';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { Link } from '@/i18n/navigation';
import { etiquetaCodigo } from '@/lib/i18n/claves';
import { localDesdeInstante } from '@/lib/fechas-zona';
import { IDIOMAS_SOPORTADOS, idiomaDe, NOMBRE_IDIOMA } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import {
  cambiarEstadoEventoAccion,
  guardarCobranzaAccion,
  guardarDatosEventoAccion,
  guardarReglamentoAccion,
  guardarTarifarioAccion,
  guardarVentanaAccion,
} from '@/modules/eventos/interface/acciones';
import { guardarAcreditacionAccion } from '@/modules/eventos/interface/acciones-acreditacion';
import { agregarCampoAdicionalAccion, quitarCampoAdicionalAccion } from '@/modules/eventos/interface/acciones-campos';
import { pendientesDeTraduccion } from '@/modules/gestion/infrastructure/traducciones';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

interface TarifarioGuardado {
  porBailarin?: { precio: number };
  porCoreografia?: { precioBase: number; porFormacion?: Record<string, number> };
  porParticipacion?: { precio: number; desdeNumero: number };
  fijoAcademia?: { precio: number };
  rubros?: { codigo: string; nombre: Traducible; precioUnitario: number }[];
  recargos?: unknown[];
}

const decimal = (c: number | undefined) => (c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','));

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-4 border-t border-borde pt-6 lg:grid-cols-[16rem_1fr]">
      <div>
        <h2 id={id} className="font-display text-lg font-bold">
          {titulo}
        </h2>
        {descripcion ? <p className="mt-1 text-sm text-texto-suave">{descripcion}</p> : null}
      </div>
      <Tarjeta>{children}</Tarjeta>
    </section>
  );
}

/** Configuración del evento por el organizador (OR-01 a OR-12). */
export default async function ConfiguracionGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, sesion, defecto } = await contextoGestion(eventoId, 'configuracion');
  const t = await getTranslations('gestion.configuracion');
  const te = await getTranslations('estados.evento');
  const tm = await getTranslations('medios');
  const tc = await getTranslations('comun');
  const nombre = evento.nombre;
  const bases = evento.bases as Traducible;
  const datosPago = evento.datos_pago as Traducible;
  const sede = evento.sede as Record<string, string | null>;
  const tarifario = evento.tarifario as TarifarioGuardado;
  const zona = evento.zona_horaria;
  const acreditacion = (evento.acreditacion ?? {}) as ConfigAcreditacion;
  const campos = leerCamposAdicionales(evento.campos_adicionales);
  const pendientes = await pendientesDeTraduccion(db, eventoId, cliente.idiomas);
  const tt = await getTranslations('acreditacion.tipos');
  const tp = await getTranslations('gestion.configuracion.traducciones.tipos');
  const zonas = Intl.supportedValuesOf('timeZone').filter((z) => /^(America|Europe|Atlantic)\//.test(z) || z === 'UTC');
  const medios = [...new Set([...MEDIOS_COBRO_DEFECTO, ...evento.medios_cobro])];
  const formaciones = evento.reglamentoTipado?.formaciones ?? [];
  const rubros = [...(tarifario.rubros ?? []), { codigo: '', nombre: {}, precioUnitario: undefined as unknown as number }];
  const posibles = transicionesPosibles(evento.estado as EstadoEvento, sesion.esSuperAdmin);
  const campoEvento = <input type="hidden" name="eventoId" value={eventoId} />;

  return (
    <div className="flex flex-col gap-6">
      <Seccion id="estado" titulo={t('estado.titulo')} descripcion={t('estado.descripcion')}>
        <div className="flex flex-wrap items-center gap-3">
          <Insignia tono={evento.publicado ? 'exito' : 'neutro'}>{te(evento.estado as EstadoEvento)}</Insignia>
          {posibles.map((estado) => (
            <FormularioAccion
              key={estado}
              accion={cambiarEstadoEventoAccion}
              namespace="gestion.configuracion"
              boton={t(`estado.pasarA.${estado}`)}
              variante="secundario"
              tamano="chico"
              enLinea
            >
              {campoEvento}
              <input type="hidden" name="estado" value={estado} />
            </FormularioAccion>
          ))}
        </div>
      </Seccion>

      <Seccion id="datos" titulo={t('datos.titulo')}>
        <FormularioAccion accion={guardarDatosEventoAccion} namespace="gestion.configuracion" boton={tc('guardar')}>
          {campoEvento}
          <CamposTraducibles
            nombre="nombre"
            etiqueta={tc('nombre')}
            valor={nombre}
            requerido
            textoRequerido={tc('requerido')}
            maxLength={200}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto name="fechaInicio" type="date" etiqueta={t('datos.fechaInicio')} defaultValue={evento.fecha_inicio} requerido />
            <CampoTexto name="fechaFin" type="date" etiqueta={t('datos.fechaFin')} defaultValue={evento.fecha_fin} requerido />
            <CampoSelector
              name="zonaHoraria"
              etiqueta={t('datos.zonaHoraria')}
              defaultValue={zona}
              opciones={zonas.map((z) => ({ valor: z, etiqueta: z }))}
            />
            <CampoSelector
              name="idiomaDefecto"
              etiqueta={t('datos.idiomaDefecto')}
              defaultValue={evento.idioma_defecto}
              opciones={IDIOMAS_SOPORTADOS.map((i) => ({ valor: i, etiqueta: NOMBRE_IDIOMA[i] }))}
            />
          </div>
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">{t('datos.sede')}</legend>
            <CampoTexto name="venue" etiqueta={t('datos.venue')} defaultValue={sede.venue ?? ''} />
            <CampoTexto name="direccion" etiqueta={t('datos.direccion')} defaultValue={sede.direccion ?? ''} />
            <CampoTexto name="ciudad" etiqueta={t('datos.ciudad')} defaultValue={sede.ciudad ?? ''} />
            <CampoTexto name="region" etiqueta={t('datos.region')} defaultValue={sede.region ?? ''} />
            <CampoTexto name="pais" etiqueta={t('datos.pais')} defaultValue={sede.pais ?? ''} />
          </fieldset>
          <CamposTraducibles nombre="bases" etiqueta={t('datos.bases')} valor={bases} area />
        </FormularioAccion>
      </Seccion>

      <Seccion id="ventana" titulo={t('ventana.titulo')} descripcion={t('ventana.descripcion', { zona })}>
        <FormularioAccion accion={guardarVentanaAccion} namespace="gestion.configuracion" boton={tc('guardar')}>
          {campoEvento}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              name="apertura"
              type="datetime-local"
              etiqueta={t('ventana.apertura')}
              defaultValue={localDesdeInstante(evento.inscripcion_apertura, zona)}
            />
            <CampoTexto
              name="cierre"
              type="datetime-local"
              etiqueta={t('ventana.cierre')}
              defaultValue={localDesdeInstante(evento.inscripcion_cierre, zona)}
            />
            <CampoTexto
              name="cierreModificaciones"
              type="datetime-local"
              etiqueta={t('ventana.cierreModificaciones')}
              ayuda={t('ventana.ayudaModificaciones')}
              defaultValue={localDesdeInstante(evento.modificaciones_cierre, zona)}
            />
            <CampoTexto
              name="cupoFichas"
              type="number"
              min={1}
              etiqueta={t('ventana.cupo')}
              ayuda={t('ventana.ayudaCupo')}
              defaultValue={evento.cupo_fichas ? String(evento.cupo_fichas) : ''}
            />
          </div>
        </FormularioAccion>
      </Seccion>

      <Seccion id="cobranza" titulo={t('cobranza.titulo')} descripcion={t('cobranza.descripcion')}>
        <FormularioAccion accion={guardarCobranzaAccion} namespace="gestion.configuracion" boton={tc('guardar')}>
          {campoEvento}
          <fieldset className="flex flex-wrap gap-x-6 gap-y-1">
            <legend className="mb-2 text-sm font-semibold">{t('cobranza.medios')}</legend>
            {medios.map((m) => (
              <label key={m} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="medios"
                  value={m}
                  defaultChecked={evento.medios_cobro.includes(m)}
                  className="size-5 accent-marca"
                />
                {etiquetaCodigo(tm, m)}
              </label>
            ))}
          </fieldset>
          <CamposTraducibles
            nombre="datosPago"
            etiqueta={t('cobranza.datosPago')}
            valor={datosPago}
            ayuda={t('cobranza.ayudaDatosPago')}
            area
          />
        </FormularioAccion>
      </Seccion>

      <Seccion id="tarifario" titulo={t('tarifario.titulo')} descripcion={t('tarifario.descripcion', { moneda: evento.moneda })}>
        <FormularioAccion accion={guardarTarifarioAccion} namespace="gestion.configuracion" boton={tc('guardar')}>
          {campoEvento}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              name="porBailarin"
              inputMode="decimal"
              etiqueta={t('tarifario.porBailarin')}
              defaultValue={decimal(tarifario.porBailarin?.precio)}
            />
            <CampoTexto
              name="porCoreografia"
              inputMode="decimal"
              etiqueta={t('tarifario.porCoreografia')}
              defaultValue={decimal(tarifario.porCoreografia?.precioBase)}
            />
            <CampoTexto
              name="porParticipacion"
              inputMode="decimal"
              etiqueta={t('tarifario.porParticipacion')}
              defaultValue={decimal(tarifario.porParticipacion?.precio)}
            />
            <CampoTexto
              name="desdeNumero"
              type="number"
              min={1}
              max={20}
              etiqueta={t('tarifario.desdeNumero')}
              ayuda={t('tarifario.ayudaDesdeNumero')}
              defaultValue={String(tarifario.porParticipacion?.desdeNumero ?? 2)}
            />
            <CampoTexto
              name="fijoAcademia"
              inputMode="decimal"
              etiqueta={t('tarifario.fijoAcademia')}
              defaultValue={decimal(tarifario.fijoAcademia?.precio)}
            />
          </div>
          {formaciones.length > 0 ? (
            <fieldset className="grid gap-4 sm:grid-cols-3">
              <legend className="mb-2 text-sm font-semibold">{t('tarifario.porFormacion')}</legend>
              {formaciones.map((f) => (
                <CampoTexto
                  key={f.codigo}
                  name={`formacion_${f.codigo}`}
                  inputMode="decimal"
                  etiqueta={texto(f.nombre, idioma, defecto)}
                  defaultValue={decimal(tarifario.porCoreografia?.porFormacion?.[f.codigo])}
                />
              ))}
            </fieldset>
          ) : null}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{t('tarifario.rubros')}</legend>
            {rubros.map((r, i) => (
              <div key={i} className="grid gap-3 rounded-md border border-borde p-3 sm:grid-cols-[8rem_1fr_8rem]">
                <CampoTexto name="rubro_codigo" etiqueta={t('tarifario.codigo')} defaultValue={r.codigo} />
                <CamposTraducibles nombre="rubro_nombre" etiqueta={tc('nombre')} valor={r.nombre} />
                <CampoTexto
                  name="rubro_precio"
                  inputMode="decimal"
                  etiqueta={t('tarifario.precio')}
                  defaultValue={decimal(r.precioUnitario)}
                />
              </div>
            ))}
          </fieldset>
          <details>
            <summary className="cursor-pointer text-sm font-medium">{t('tarifario.avanzado')}</summary>
            <CampoArea
              name="recargos"
              etiqueta={t('tarifario.recargos')}
              ayuda={t('tarifario.ayudaRecargos')}
              defaultValue={tarifario.recargos?.length ? JSON.stringify(tarifario.recargos, null, 2) : ''}
              className="mt-2 font-mono text-xs"
            />
          </details>
        </FormularioAccion>
      </Seccion>

      <Seccion id="acreditacion" titulo={t('acreditacion.titulo')} descripcion={t('acreditacion.descripcion')}>
        <FormularioAccion
          accion={guardarAcreditacionAccion}
          namespace="gestion.configuracion.acreditacion"
          boton={tc('guardar')}
          variante="secundario"
        >
          {campoEvento}
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto
              name="apertura"
              type="datetime-local"
              etiqueta={t('acreditacion.apertura')}
              ayuda={t('acreditacion.ayudaHorario', { zona })}
              defaultValue={localDesdeInstante(acreditacion.horario?.apertura, zona)}
            />
            <CampoTexto
              name="cierre"
              type="datetime-local"
              etiqueta={t('acreditacion.cierre')}
              defaultValue={localDesdeInstante(acreditacion.horario?.cierre, zona)}
            />
            {TIPOS_CREDENCIAL.map((tipo) => (
              <CampoTexto
                key={tipo}
                name={`zonas.${tipo}`}
                etiqueta={t('acreditacion.zonas', { tipo: tt(tipo) })}
                ayuda={t('acreditacion.zonasAyuda')}
                defaultValue={(acreditacion.zonasPorTipo?.[tipo] ?? []).join(', ')}
                maxLength={500}
              />
            ))}
          </div>
        </FormularioAccion>
      </Seccion>

      <Seccion id="campos" titulo={t('campos.titulo')} descripcion={t('campos.descripcion')}>
        <div className="flex flex-col gap-4">
          {AMBITOS_CAMPO.map((ambito) => (
            <div key={ambito} className="flex flex-col gap-2">
              <h3 className="font-semibold">{t(`campos.ambitos.${ambito}`)}</h3>
              {campos[ambito].length === 0 ? <p className="text-sm text-texto-suave">{t('campos.sinCampos')}</p> : null}
              <ul className="flex flex-col divide-y divide-borde">
                {campos[ambito].map((c) => (
                  <li key={c.codigo} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      <span className="font-medium">{texto(c.etiqueta, idioma, defecto)}</span>
                      <span className="text-texto-suave">
                        {' '}
                        · {t(`campos.tipos.${c.tipo}`)}
                        {c.obligatorio ? ` · ${t('campos.obligatorio')}` : ''}
                        {c.opciones ? ` · ${c.opciones.join(', ')}` : ''}
                      </span>
                    </span>
                    <FormularioAccion
                      accion={quitarCampoAdicionalAccion}
                      namespace="gestion.configuracion.campos"
                      boton={t('campos.quitar')}
                      variante="fantasma"
                      tamano="chico"
                      enLinea
                    >
                      {campoEvento}
                      <input type="hidden" name="ambito" value={ambito} />
                      <input type="hidden" name="codigo" value={c.codigo} />
                    </FormularioAccion>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <details className="rounded-[var(--radio)] border border-dashed border-borde p-4">
            <summary className="cursor-pointer font-medium">{t('campos.nuevo')}</summary>
            <FormularioAccion
              accion={agregarCampoAdicionalAccion}
              namespace="gestion.configuracion.campos"
              boton={tc('agregar')}
              className="mt-3"
            >
              {campoEvento}
              <div className="grid gap-4 sm:grid-cols-3">
                <CampoSelector
                  name="ambito"
                  etiqueta={t('campos.ambito')}
                  opciones={AMBITOS_CAMPO.map((a) => ({ valor: a, etiqueta: t(`campos.ambitos.${a}`) }))}
                />
                <CampoTexto
                  name="codigo"
                  etiqueta={t('campos.codigo')}
                  ayuda={t('campos.codigoAyuda')}
                  requerido
                  textoRequerido={tc('requerido')}
                  maxLength={30}
                />
                <CampoSelector
                  name="tipo"
                  etiqueta={t('campos.tipo')}
                  opciones={(['TEXTO', 'NUMERO', 'BOOLEANO', 'FECHA', 'OPCION'] as const).map((tipo) => ({
                    valor: tipo,
                    etiqueta: t(`campos.tipos.${tipo}`),
                  }))}
                />
              </div>
              <CamposTraducibles
                nombre="etiqueta"
                etiqueta={t('campos.etiqueta')}
                requerido
                textoRequerido={tc('requerido')}
                maxLength={120}
              />
              <CampoTexto name="opciones" etiqueta={t('campos.opciones')} ayuda={t('campos.opcionesAyuda')} maxLength={1000} />
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="obligatorio" className="size-5 accent-marca" />
                {t('campos.obligatorio')}
              </label>
            </FormularioAccion>
          </details>
        </div>
      </Seccion>

      <Seccion id="traducciones" titulo={t('traducciones.titulo')} descripcion={t('traducciones.descripcion')}>
        {pendientes.length === 0 ? (
          <p className="text-sm" role="status">
            {t('traducciones.completas')}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {pendientes.map((p) => (
              <li key={p.clave} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{tp(p.tipo as 'criterio')}</span>
                  {p.referencia ? <span className="text-texto-suave"> · {p.referencia}</span> : null}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {p.faltan.map((i) => (
                    <Insignia key={i} tono="alerta">
                      {t('traducciones.falta', { idioma: NOMBRE_IDIOMA[i] })}
                    </Insignia>
                  ))}
                  <Link
                    href={`/gestion/${eventoId}${p.seccion === 'configuracion' ? '/configuracion' : `/${p.seccion}`}`}
                    className="font-medium text-marca underline-offset-4 hover:underline"
                  >
                    {t('traducciones.editar')}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion
        id="reglamento"
        titulo={t('reglamento.titulo')}
        descripcion={t('reglamento.descripcion', { version: evento.reglamento_version })}
      >
        {!evento.reglamentoValido ? <Aviso tono="error">{t('reglamento.invalido')}</Aviso> : null}
        <FormularioAccion
          accion={guardarReglamentoAccion}
          namespace="gestion.configuracion"
          boton={t('reglamento.guardar')}
          variante="secundario"
        >
          {campoEvento}
          <CampoArea
            name="reglamento"
            etiqueta={t('reglamento.json')}
            ayuda={t('reglamento.ayuda')}
            defaultValue={JSON.stringify(evento.reglamento, null, 2)}
            className="min-h-96 font-mono text-xs"
            spellCheck={false}
          />
        </FormularioAccion>
      </Seccion>
    </div>
  );
}
