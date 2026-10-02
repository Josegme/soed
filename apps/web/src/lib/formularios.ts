import type { z } from 'zod';

/** Estado devuelto por una server action de formulario (códigos de error traducibles). */
export interface EstadoFormulario {
  ok: boolean;
  /** Código del mensaje general (namespace errores o específico de la pantalla). */
  mensaje?: string;
  /** Errores por campo: código traducible. */
  errores?: Record<string, string>;
  /** Valores enviados, para repoblar el formulario sin perder lo escrito. */
  valores?: Record<string, string>;
}

export const ESTADO_INICIAL: EstadoFormulario = { ok: false };

export function valoresDe(formData: FormData): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === 'string' && !/password/i.test(k)) valores[k] = v;
  return valores;
}

/** Convierte los issues de Zod en errores por campo (primer código por campo). */
export function erroresDe(error: z.ZodError): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = issue.path.join('.') || '_';
    errores[campo] ??= /^[A-Z_]+$/.test(issue.message) ? issue.message : 'REQUERIDO';
  }
  return errores;
}
