'use client';

import { Aviso, Boton } from '@soed/ui';
import { useTranslations, type Messages, type NamespaceKeys, type NestedKeyOf } from 'next-intl';
import { useActionState, useRef, type ReactNode } from 'react';
import { cn } from '@soed/ui';
import { ESTADO_INICIAL, type EstadoFormulario } from '@/lib/formularios';
import { libre } from '@/lib/i18n/claves';

/** Namespace de mensajes válido (tipado por next-intl). */
export type EspacioMensajes = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

export type AccionFormulario = (previo: EstadoFormulario, datos: FormData) => Promise<EstadoFormulario>;

/** Mensaje de un estado de formulario: primero el namespace propio, luego comunes y errores. */
export function useMensaje(namespace: EspacioMensajes) {
  const t = libre(useTranslations(namespace));
  const te = libre(useTranslations('errores'));
  const tc = libre(useTranslations('comun'));
  return {
    general(estado: EstadoFormulario, valores: Record<string, string | number> | undefined = estado.valores) {
      if (!estado.mensaje) return null;
      if (t.has(estado.mensaje)) return t(estado.mensaje, valores);
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

/**
 * Formulario de una server action con mensaje accesible (role=status/alert).
 * `idempotente` agrega un client_uuid que se renueva tras cada éxito, para que
 * un doble envío no registre dos veces (ADR-0010).
 */
export function FormularioAccion({
  accion,
  namespace,
  boton,
  variante = 'primario',
  tamano = 'normal',
  idempotente = false,
  enLinea = false,
  className,
  children,
}: {
  accion: AccionFormulario;
  namespace: EspacioMensajes;
  boton: string;
  variante?: 'primario' | 'secundario' | 'peligro' | 'acento' | 'fantasma';
  tamano?: 'normal' | 'chico';
  idempotente?: boolean;
  enLinea?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  // El mismo client_uuid se reutiliza en reintentos tras un fallo y se renueva solo tras un éxito.
  const clientUuid = useRef<string | null>(null);
  const [estado, ejecutar, pendiente] = useActionState(async (previo: EstadoFormulario, datos: FormData) => {
    if (idempotente) datos.set('clientUuid', (clientUuid.current ??= crypto.randomUUID()));
    const r = await accion(previo, datos);
    if (r.ok) clientUuid.current = null;
    return r;
  }, ESTADO_INICIAL);
  const m = useMensaje(namespace);
  const mensaje = m.general(estado);
  const errores = Object.keys(estado.errores ?? {});
  return (
    <form action={ejecutar} noValidate className={cn(enLinea ? 'flex flex-wrap items-end gap-2' : 'flex flex-col gap-4', className)}>
      {children}
      <div className={enLinea ? '' : 'flex flex-wrap items-center gap-3'}>
        <Boton type="submit" variante={variante} tamano={tamano} cargando={pendiente}>
          {boton}
        </Boton>
      </div>
      {mensaje ? (
        enLinea ? (
          <p role={estado.ok ? 'status' : 'alert'} className={cn('basis-full text-sm', estado.ok ? 'text-exito' : 'text-error')}>
            {mensaje}
          </p>
        ) : (
          <Aviso tono={estado.ok ? 'exito' : 'error'}>{mensaje}</Aviso>
        )
      ) : errores.length > 0 ? (
        <p role="alert" className="basis-full text-sm text-error">
          {errores.map((c) => m.campo(estado, c)).join(' · ')}
        </p>
      ) : null}
    </form>
  );
}
