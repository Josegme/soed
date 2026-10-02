'use client';

import type { Idioma } from '@soed/domain';
import { Aviso, Boton, CampoSelector, CampoTexto } from '@soed/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/formularios';
import { NOMBRE_IDIOMA } from '@/lib/i18n/locales';
import { routing } from '@/i18n/routing';
import { enviarEnlace, ingresar, registrarse } from './acciones';

function useMensajes() {
  const ta = useTranslations('auth');
  const te = useTranslations('errores');
  const tc = useTranslations('comun');
  const error = (estado: EstadoFormulario, campo: string) => {
    const codigo = estado.errores?.[campo];
    return codigo ? te(codigo as 'REQUERIDO') : undefined;
  };
  const general = (estado: EstadoFormulario) => {
    if (!estado.mensaje) return null;
    return ta.has(estado.mensaje as 'email') ? ta(estado.mensaje as 'email') : te(estado.mensaje as 'INESPERADO');
  };
  return { ta, tc, error, general };
}

export function FormularioIngreso({ siguiente }: { siguiente?: string }) {
  const { ta, tc, error, general } = useMensajes();
  const [estado, accion, pendiente] = useActionState(ingresar, ESTADO_INICIAL);
  const [estadoEnlace, accionEnlace, pendienteEnlace] = useActionState(enviarEnlace, ESTADO_INICIAL);
  const mensaje = general(estado);
  const mensajeEnlace = general(estadoEnlace);
  return (
    <div className="flex flex-col gap-6">
      <form action={accion} className="flex flex-col gap-4" noValidate>
        {siguiente ? <input type="hidden" name="siguiente" value={siguiente} /> : null}
        {mensaje ? <Aviso tono="error">{mensaje}</Aviso> : null}
        <CampoTexto
          name="email"
          type="email"
          autoComplete="email"
          etiqueta={ta('email')}
          requerido
          textoRequerido={tc('requerido')}
          defaultValue={estado.valores?.email}
          error={error(estado, 'email')}
        />
        <CampoTexto
          name="password"
          type="password"
          autoComplete="current-password"
          etiqueta={ta('password')}
          requerido
          textoRequerido={tc('requerido')}
          error={error(estado, 'password')}
        />
        <Boton type="submit" cargando={pendiente} ancho="completo">
          {ta('ingresar')}
        </Boton>
      </form>
      <details className="rounded-[var(--radio)] border border-borde bg-superficie p-4">
        <summary className="cursor-pointer font-semibold">{ta('conEnlace')}</summary>
        <form action={accionEnlace} className="mt-4 flex flex-col gap-4" noValidate>
          {siguiente ? <input type="hidden" name="siguiente" value={siguiente} /> : null}
          {mensajeEnlace ? <Aviso tono={estadoEnlace.ok ? 'exito' : 'error'}>{mensajeEnlace}</Aviso> : null}
          <CampoTexto
            name="email"
            type="email"
            autoComplete="email"
            etiqueta={ta('email')}
            requerido
            textoRequerido={tc('requerido')}
            defaultValue={estadoEnlace.valores?.email}
            error={error(estadoEnlace, 'email')}
          />
          <Boton type="submit" variante="secundario" cargando={pendienteEnlace}>
            {ta('enviarEnlace')}
          </Boton>
        </form>
      </details>
    </div>
  );
}

export function FormularioRegistro() {
  const { ta, tc, error, general } = useMensajes();
  const locale = useLocale() as Idioma;
  const [estado, accion, pendiente] = useActionState(registrarse, ESTADO_INICIAL);
  const mensaje = general(estado);
  if (estado.ok) return <Aviso tono="exito">{mensaje}</Aviso>;
  return (
    <form action={accion} className="flex flex-col gap-4" noValidate>
      {mensaje ? <Aviso tono="error">{mensaje}</Aviso> : null}
      <CampoTexto
        name="nombre"
        autoComplete="name"
        etiqueta={ta('tuNombre')}
        requerido
        textoRequerido={tc('requerido')}
        defaultValue={estado.valores?.nombre}
        error={error(estado, 'nombre')}
      />
      <CampoTexto
        name="email"
        type="email"
        autoComplete="email"
        etiqueta={ta('email')}
        requerido
        textoRequerido={tc('requerido')}
        defaultValue={estado.valores?.email}
        error={error(estado, 'email')}
      />
      <CampoTexto
        name="password"
        type="password"
        autoComplete="new-password"
        etiqueta={ta('password')}
        ayuda={ta('passwordAyuda')}
        requerido
        textoRequerido={tc('requerido')}
        error={error(estado, 'password')}
      />
      <CampoSelector
        name="idioma"
        etiqueta={ta('idiomaPreferido')}
        defaultValue={estado.valores?.idioma ?? locale}
        opciones={routing.locales.map((l) => ({ valor: l, etiqueta: NOMBRE_IDIOMA[l] }))}
      />
      <Boton type="submit" cargando={pendiente} ancho="completo">
        {ta('crearCuenta')}
      </Boton>
    </form>
  );
}
