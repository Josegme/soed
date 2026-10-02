import { IDIOMAS, type Idioma } from '@soed/domain';
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

/** '150,50' o '150.50' → 15050 centavos. Sin separador de miles para evitar ambigüedad es/pt-BR/en. */
export function parsearMonto(texto: string | null | undefined): number | null {
  const m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec((texto ?? '').trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Texto de un campo del formulario, sin espacios; null si está vacío. */
export function textoDe(datos: FormData, campo: string): string | null {
  const v = datos.get(campo);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * Traducible desde campos `<campo>.<idioma>` (uno por idioma soportado, ADR-0005):
 * agregar un idioma no requiere tocar formularios ni acciones.
 */
export function traducibleDe(datos: FormData, campo: string): Partial<Record<Idioma, string>> {
  const salida: Partial<Record<Idioma, string>> = {};
  for (const idioma of IDIOMAS) {
    const v = textoDe(datos, `${campo}.${idioma}`);
    if (v) salida[idioma] = v;
  }
  return salida;
}

/** Igual que traducibleDe para campos repetidos (listas): devuelve un traducible por posición. */
export function traduciblesDe(datos: FormData, campo: string): Partial<Record<Idioma, string>>[] {
  const porIdioma = IDIOMAS.map((idioma) => datos.getAll(`${campo}.${idioma}`).map((v) => String(v).trim()));
  const largo = Math.max(0, ...porIdioma.map((l) => l.length));
  return Array.from({ length: largo }, (_, i) => {
    const t: Partial<Record<Idioma, string>> = {};
    IDIOMAS.forEach((idioma, j) => {
      const v = porIdioma[j]?.[i];
      if (v) t[idioma] = v;
    });
    return t;
  });
}
