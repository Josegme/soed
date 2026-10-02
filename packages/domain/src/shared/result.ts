/**
 * Result Pattern: los casos de uso y reglas devuelven Result en lugar de lanzar
 * excepciones por errores de negocio.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Error de negocio con código estable (se traduce en la interfaz) y parámetros opcionales. */
export interface ErrorDominio<C extends string = string> {
  readonly codigo: C;
  readonly params?: Readonly<Record<string, string | number>>;
}

export const errorDominio = <C extends string>(codigo: C, params?: Record<string, string | number>): ErrorDominio<C> =>
  params === undefined ? { codigo } : { codigo, params };
