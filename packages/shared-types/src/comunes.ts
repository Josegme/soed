import { IDIOMAS, MONEDAS, esFechaISO, type FechaISO, type Traducible } from '@soed/domain';
import { z } from 'zod';

export const idiomaSchema = z.enum(IDIOMAS);
export const monedaSchema = z.enum(MONEDAS);
export const uuidSchema = z.uuid();
export const codigoSchema = z.string().regex(/^[A-Z0-9_]{1,40}$/, 'CODIGO_INVALIDO');

export const traducibleSchema = z.partialRecord(idiomaSchema, z.string().max(20000)) satisfies z.ZodType<Traducible>;

/** Traducible con al menos un idioma con texto. */
export const traducibleRequeridoSchema = traducibleSchema.refine(
  (t) => Object.values(t).some((v) => typeof v === 'string' && v.trim().length > 0),
  { message: 'TRADUCCION_REQUERIDA' },
);

export const fechaISOSchema = z
  .string()
  .refine(esFechaISO, { message: 'FECHA_INVALIDA' })
  .transform((v) => v as FechaISO);

export const instanteSchema = z.iso.datetime({ offset: true });

/** Centavos enteros no negativos. */
export const centavosSchema = z.int().min(0).max(Number.MAX_SAFE_INTEGER);
