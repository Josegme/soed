import { cva, type VariantProps } from 'class-variance-authority';
import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type TextareaHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cn } from './utilidades';

/*
 * Componentes base. Reglas de accesibilidad (WCAG 2.2 AA):
 * - Objetivo táctil mínimo de 44 px en controles.
 * - Foco siempre visible (anillo de 3 px en color de marca).
 * - Etiquetas visibles; errores asociados con aria-describedby.
 * - Ningún texto literal: todo llega por props ya traducido.
 */

const foco =
  'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-marca/60 focus-visible:ring-offset-2 focus-visible:ring-offset-fondo';

export const estilosBoton = cva(
  `inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radio)] px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${foco}`,
  {
    variants: {
      variante: {
        primario: 'bg-marca text-marca-contraste hover:bg-marca/90',
        acento: 'bg-acento text-acento-contraste hover:bg-acento/90',
        secundario: 'border border-borde bg-superficie text-texto hover:bg-superficie-2',
        fantasma: 'text-texto hover:bg-superficie-2',
        peligro: 'bg-error text-white hover:bg-error/90',
      },
      tamano: {
        normal: '',
        chico: 'min-h-9 px-3 text-xs',
        grande: 'min-h-12 px-6 text-base',
      },
      ancho: { auto: '', completo: 'w-full' },
    },
    defaultVariants: { variante: 'primario', tamano: 'normal', ancho: 'auto' },
  },
);

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof estilosBoton> {
  cargando?: boolean;
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { className, variante, tamano, ancho, cargando = false, disabled, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(estilosBoton({ variante, tamano, ancho }), className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      {...props}
    >
      {cargando ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
});

const estilosControl = `block w-full min-h-11 rounded-[var(--radio)] border border-borde bg-superficie px-3 text-base text-texto placeholder:text-texto-suave/80 aria-[invalid=true]:border-error ${foco}`;

interface CampoBase {
  etiqueta: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  /** Texto accesible del indicador de obligatorio (traducido). */
  textoRequerido?: string;
}

function EnvolturaCampo({
  id,
  etiqueta,
  ayuda,
  error,
  requerido,
  textoRequerido,
  children,
}: CampoBase & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
        {requerido ? (
          <span className="ml-0.5 text-error" aria-hidden>
            *
          </span>
        ) : null}
        {requerido && textoRequerido ? <span className="sr-only"> ({textoRequerido})</span> : null}
      </label>
      {children}
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-texto-suave">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, ayuda?: string, error?: string): string | undefined =>
  [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

export type CampoTextoProps = CampoBase & InputHTMLAttributes<HTMLInputElement>;

export const CampoTexto = forwardRef<HTMLInputElement, CampoTextoProps>(function CampoTexto(
  { etiqueta, ayuda, error, requerido, textoRequerido, id, className, ...props },
  ref,
) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <EnvolturaCampo id={campoId} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} textoRequerido={textoRequerido}>
      <input
        ref={ref}
        id={campoId}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(campoId, ayuda, error)}
        className={cn(estilosControl, className)}
        {...props}
      />
    </EnvolturaCampo>
  );
});

export type CampoAreaProps = CampoBase & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const CampoArea = forwardRef<HTMLTextAreaElement, CampoAreaProps>(function CampoArea(
  { etiqueta, ayuda, error, requerido, textoRequerido, id, className, ...props },
  ref,
) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <EnvolturaCampo id={campoId} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} textoRequerido={textoRequerido}>
      <textarea
        ref={ref}
        id={campoId}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(campoId, ayuda, error)}
        className={cn(estilosControl, 'min-h-28 py-2', className)}
        {...props}
      />
    </EnvolturaCampo>
  );
});

export interface OpcionSelector {
  valor: string;
  etiqueta: string;
}

export type CampoSelectorProps = CampoBase &
  SelectHTMLAttributes<HTMLSelectElement> & { opciones: readonly OpcionSelector[]; vacio?: string };

export const CampoSelector = forwardRef<HTMLSelectElement, CampoSelectorProps>(function CampoSelector(
  { etiqueta, ayuda, error, requerido, textoRequerido, id, className, opciones, vacio, ...props },
  ref,
) {
  const generado = useId();
  const campoId = id ?? generado;
  return (
    <EnvolturaCampo id={campoId} etiqueta={etiqueta} ayuda={ayuda} error={error} requerido={requerido} textoRequerido={textoRequerido}>
      <select
        ref={ref}
        id={campoId}
        required={requerido}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(campoId, ayuda, error)}
        className={cn(estilosControl, 'pr-8', className)}
        {...props}
      >
        {vacio !== undefined ? <option value="">{vacio}</option> : null}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </EnvolturaCampo>
  );
});

export function Tarjeta({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--radio)] border border-borde bg-superficie p-5', className)} {...props} />;
}

const estilosInsignia = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', {
  variants: {
    tono: {
      neutro: 'bg-superficie-2 text-texto',
      exito: 'bg-exito/12 text-exito',
      alerta: 'bg-alerta/12 text-alerta',
      error: 'bg-error/10 text-error',
      info: 'bg-info/10 text-info',
      marca: 'bg-marca text-marca-contraste',
    },
  },
  defaultVariants: { tono: 'neutro' },
});

export type InsigniaProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof estilosInsignia>;

export function Insignia({ className, tono, ...props }: InsigniaProps) {
  return <span className={cn(estilosInsignia({ tono }), className)} {...props} />;
}

const estilosAviso = cva('flex gap-3 rounded-[var(--radio)] border p-4 text-sm', {
  variants: {
    tono: {
      info: 'border-info/30 bg-info/5 text-texto',
      exito: 'border-exito/30 bg-exito/5 text-texto',
      alerta: 'border-alerta/40 bg-alerta/5 text-texto',
      error: 'border-error/40 bg-error/5 text-texto',
    },
  },
  defaultVariants: { tono: 'info' },
});

export type AvisoProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof estilosAviso> & { titulo?: string };

export function Aviso({ className, tono, titulo, children, ...props }: AvisoProps) {
  const rol = tono === 'error' || tono === 'alerta' ? 'alert' : 'status';
  return (
    <div role={rol} className={cn(estilosAviso({ tono }), className)} {...props}>
      <div className="flex flex-col gap-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function Tabla({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-[var(--radio)] border border-borde">
      <table className={cn('w-full border-collapse bg-superficie text-left text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope="col" className={cn('border-b border-borde bg-superficie-2 px-3 py-2.5 font-semibold text-texto', className)} {...props} />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-borde px-3 py-2.5 align-top text-texto', className)} {...props} />;
}

export function EstadoVacio({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[var(--radio)] border border-dashed border-borde bg-superficie p-6">
      <p className="font-semibold text-texto">{titulo}</p>
      {descripcion ? <p className="text-sm text-texto-suave">{descripcion}</p> : null}
      {accion}
    </div>
  );
}

export function EncabezadoPagina({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-borde pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight text-texto sm:text-3xl">{titulo}</h1>
        {descripcion ? <p className="max-w-prose text-texto-suave">{descripcion}</p> : null}
      </div>
      {acciones ? <div className="flex flex-wrap gap-2">{acciones}</div> : null}
    </div>
  );
}

/** Dato numérico destacado para tableros. */
export function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radio)] border border-borde bg-superficie p-4">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="font-display text-2xl font-bold tabular-nums text-texto">{valor}</dd>
      {detalle ? <dd className="text-xs text-texto-suave">{detalle}</dd> : null}
    </div>
  );
}
