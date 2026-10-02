'use client';

import type { Idioma, ReglamentoEvento } from '@soed/domain';
import { Aviso, Boton, CampoSelector, CampoTexto, Tarjeta } from '@soed/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useTransition, useState } from 'react';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/formularios';
import { texto } from '@/lib/i18n/traducible';
import { cambiarActivoBailarin, guardarAcademia, guardarBailarin, guardarCoreografia } from './acciones';

/** Mensaje de un estado de formulario: primero el namespace propio, luego errores comunes. */
export function useMensaje(namespace: string) {
  const t = useTranslations(namespace);
  const te = useTranslations('errores');
  const tc = useTranslations('comun');
  return {
    general(estado: EstadoFormulario) {
      if (!estado.mensaje) return null;
      if (t.has(estado.mensaje)) return t(estado.mensaje);
      if (tc.has(estado.mensaje)) return tc(estado.mensaje);
      return te.has(estado.mensaje) ? te(estado.mensaje) : te('INESPERADO');
    },
    campo(estado: EstadoFormulario, nombre: string) {
      const codigo = estado.errores?.[nombre];
      if (!codigo) return undefined;
      return te.has(codigo) ? te(codigo) : te('REQUERIDO');
    },
  };
}

interface DatosAcademia {
  id?: string;
  nombre?: string;
  ciudad?: string | null;
  region?: string | null;
  pais?: string | null;
  email?: string | null;
  telefono?: string | null;
}

export function FormularioAcademia({ academia }: { academia?: DatosAcademia }) {
  const t = useTranslations('academia');
  const tc = useTranslations('comun');
  const m = useMensaje('academia');
  const [estado, accion, pendiente] = useActionState(guardarAcademia, ESTADO_INICIAL);
  const v = (campo: keyof DatosAcademia) => estado.valores?.[campo] ?? (academia?.[campo] as string | undefined) ?? '';
  const mensaje = m.general(estado);
  return (
    <form action={accion} className="flex max-w-xl flex-col gap-4" noValidate>
      {mensaje ? <Aviso tono={estado.ok ? 'exito' : 'error'}>{mensaje}</Aviso> : null}
      {academia?.id ? <input type="hidden" name="id" value={academia.id} /> : null}
      <CampoTexto
        name="nombre"
        etiqueta={t('nombre')}
        requerido
        textoRequerido={tc('requerido')}
        defaultValue={v('nombre')}
        error={m.campo(estado, 'nombre')}
        autoComplete="organization"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto name="ciudad" etiqueta={t('ciudad')} defaultValue={v('ciudad')} autoComplete="address-level2" />
        <CampoTexto name="region" etiqueta={t('region')} defaultValue={v('region')} autoComplete="address-level1" />
        <CampoTexto name="pais" etiqueta={t('pais')} defaultValue={v('pais')} autoComplete="country-name" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto
          name="email"
          type="email"
          etiqueta={t('email')}
          defaultValue={v('email')}
          error={m.campo(estado, 'email')}
          autoComplete="email"
        />
        <CampoTexto name="telefono" type="tel" etiqueta={t('telefono')} defaultValue={v('telefono')} autoComplete="tel" />
      </div>
      <div>
        <Boton type="submit" cargando={pendiente}>
          {academia?.id ? tc('guardar') : t('crear')}
        </Boton>
      </div>
    </form>
  );
}

export function FormularioBailarin({ academiaId }: { academiaId: string }) {
  const t = useTranslations('academia.bailarines');
  const tc = useTranslations('comun');
  const m = useMensaje('academia.bailarines');
  const [estado, accion, pendiente] = useActionState(guardarBailarin, ESTADO_INICIAL);
  const mensaje = m.general(estado);
  const v = (c: string) => (estado.ok ? '' : (estado.valores?.[c] ?? ''));
  return (
    <Tarjeta>
      <form action={accion} className="flex flex-col gap-4" noValidate>
        <h2 className="font-display text-lg font-bold">{t('agregar')}</h2>
        {mensaje ? <Aviso tono={estado.ok ? 'exito' : 'error'}>{mensaje}</Aviso> : null}
        <input type="hidden" name="academiaId" value={academiaId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            name="nombre"
            etiqueta={t('nombre')}
            requerido
            textoRequerido={tc('requerido')}
            defaultValue={v('nombre')}
            error={m.campo(estado, 'nombre')}
          />
          <CampoTexto
            name="apellido"
            etiqueta={t('apellido')}
            requerido
            textoRequerido={tc('requerido')}
            defaultValue={v('apellido')}
            error={m.campo(estado, 'apellido')}
          />
        </div>
        <CampoTexto
          name="fechaNacimiento"
          type="date"
          etiqueta={t('fechaNacimiento')}
          requerido
          textoRequerido={tc('requerido')}
          defaultValue={v('fechaNacimiento')}
          error={m.campo(estado, 'fechaNacimiento')}
        />
        <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <CampoTexto name="documentoTipo" etiqueta={t('documentoTipo')} defaultValue={v('documentoTipo')} />
          <CampoTexto
            name="documentoNumero"
            etiqueta={t('documentoNumero')}
            ayuda={t('ayudaDocumento')}
            defaultValue={v('documentoNumero')}
          />
        </div>
        <div>
          <Boton type="submit" cargando={pendiente}>
            {t('agregar')}
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

export function BotonActivoBailarin({ bailarinId, activo }: { bailarinId: string; activo: boolean }) {
  const t = useTranslations('academia.bailarines');
  const [pendiente, iniciar] = useTransition();
  return (
    <Boton
      variante="fantasma"
      tamano="chico"
      cargando={pendiente}
      onClick={() => iniciar(async () => void (await cambiarActivoBailarin(bailarinId, !activo)))}
    >
      {activo ? t('darDeBaja') : t('reactivar')}
    </Boton>
  );
}

interface OpcionBailarin {
  id: string;
  nombre: string;
}

interface CoreografiaEditable {
  id: string;
  nombre: string;
  genero: string;
  formacion: string;
  coreografo: string | null;
  elenco: { bailarinId: string; esCoreografo: boolean }[];
}

export function FormularioCoreografia({
  academiaId,
  bailarines,
  reglamento,
  coreografia,
}: {
  academiaId: string;
  bailarines: OpcionBailarin[];
  reglamento: ReglamentoEvento | null;
  coreografia?: CoreografiaEditable;
}) {
  const t = useTranslations('academia.coreografias');
  const tc = useTranslations('comun');
  const idioma = useLocale() as Idioma;
  const m = useMensaje('academia.coreografias');
  const [estado, accion, pendiente] = useActionState(guardarCoreografia, ESTADO_INICIAL);
  const [elenco, setElenco] = useState<Set<string>>(new Set(coreografia?.elenco.map((e) => e.bailarinId) ?? []));
  const mensaje = m.general(estado);
  const opciones = (lista: 'generos' | 'formaciones') =>
    (reglamento?.[lista] ?? []).map((x) => ({ valor: x.codigo, etiqueta: texto(x.nombre, idioma) || x.codigo }));

  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {mensaje ? <Aviso tono={estado.ok ? 'exito' : 'error'}>{mensaje}</Aviso> : null}
      <input type="hidden" name="academiaId" value={academiaId} />
      {coreografia ? <input type="hidden" name="id" value={coreografia.id} /> : null}
      <CampoTexto
        name="nombre"
        etiqueta={t('nombre')}
        requerido
        textoRequerido={tc('requerido')}
        defaultValue={estado.valores?.nombre ?? coreografia?.nombre}
        error={m.campo(estado, 'nombre')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoSelector
          name="genero"
          etiqueta={t('genero')}
          requerido
          textoRequerido={tc('requerido')}
          vacio={tc('seleccionar')}
          opciones={opciones('generos')}
          defaultValue={estado.valores?.genero ?? coreografia?.genero ?? ''}
          error={m.campo(estado, 'genero')}
        />
        <CampoSelector
          name="formacion"
          etiqueta={t('formacion')}
          requerido
          textoRequerido={tc('requerido')}
          vacio={tc('seleccionar')}
          opciones={opciones('formaciones')}
          defaultValue={estado.valores?.formacion ?? coreografia?.formacion ?? ''}
          error={m.campo(estado, 'formacion')}
        />
      </div>
      <CampoTexto
        name="nombreCoreografo"
        etiqueta={t('coreografo')}
        defaultValue={estado.valores?.nombreCoreografo ?? coreografia?.coreografo ?? ''}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t('elenco')}</legend>
        <p className="text-sm text-texto-suave">{t('elencoAyuda')}</p>
        {bailarines.length === 0 ? <Aviso tono="info">{t('sinBailarinesAviso')}</Aviso> : null}
        <ul className="grid gap-1 sm:grid-cols-2">
          {bailarines.map((b) => {
            const marcado = elenco.has(b.id);
            const esCoreografo = coreografia?.elenco.find((e) => e.bailarinId === b.id)?.esCoreografo ?? false;
            return (
              <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-borde px-3 py-2">
                <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    name="elenco"
                    value={b.id}
                    checked={marcado}
                    onChange={(e) => {
                      const nuevo = new Set(elenco);
                      if (e.target.checked) nuevo.add(b.id);
                      else nuevo.delete(b.id);
                      setElenco(nuevo);
                    }}
                    className="size-5 accent-[var(--marca)]"
                  />
                  <span>{b.nombre}</span>
                </label>
                {marcado ? (
                  <label className="flex items-center gap-2 text-sm text-texto-suave">
                    <input
                      type="checkbox"
                      name="coreografo"
                      value={b.id}
                      defaultChecked={esCoreografo}
                      className="size-4 accent-[var(--marca)]"
                    />
                    {t('esCoreografo')}
                  </label>
                ) : null}
              </li>
            );
          })}
        </ul>
        {m.campo(estado, 'elenco') ? (
          <p className="text-sm font-medium text-error" role="alert">
            {m.campo(estado, 'elenco')}
          </p>
        ) : null}
      </fieldset>
      <div>
        <Boton type="submit" cargando={pendiente}>
          {tc('guardar')}
        </Boton>
      </div>
    </form>
  );
}
