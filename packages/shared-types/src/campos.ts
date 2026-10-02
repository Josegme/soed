import type { CampoAdicional } from '@soed/domain';
import { z } from 'zod';
import { traducibleRequeridoSchema } from './comunes';

/** Definición de un campo adicional (OR-16). El código es la clave estable en datos_adicionales. */
export const campoAdicionalSchema = z
  .object({
    codigo: z.string().regex(/^[a-z][a-z0-9_]{1,29}$/, 'CODIGO_INVALIDO'),
    etiqueta: traducibleRequeridoSchema,
    tipo: z.enum(['TEXTO', 'NUMERO', 'BOOLEANO', 'FECHA', 'OPCION']),
    obligatorio: z.boolean(),
    opciones: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  })
  .refine((c) => c.tipo !== 'OPCION' || (c.opciones?.length ?? 0) >= 2, { message: 'OPCIONES_REQUERIDAS', path: ['opciones'] })
  .transform((c) => (c.tipo === 'OPCION' ? c : { ...c, opciones: undefined })) satisfies z.ZodType<CampoAdicional>;

export const AMBITOS_CAMPO = ['inscripcion', 'ficha'] as const;
export type AmbitoCampo = (typeof AMBITOS_CAMPO)[number];

/** `evento.campos_adicionales`: lo que no valida se descarta al leer (nunca rompe la pantalla). */
export const camposAdicionalesSchema = z.object({
  inscripcion: z.array(campoAdicionalSchema).max(20).catch([]).default([]),
  ficha: z.array(campoAdicionalSchema).max(20).catch([]).default([]),
});
export type CamposAdicionalesEvento = z.infer<typeof camposAdicionalesSchema>;

export function leerCamposAdicionales(crudo: unknown): CamposAdicionalesEvento {
  const r = camposAdicionalesSchema.safeParse(crudo ?? {});
  return r.success ? r.data : { inscripcion: [], ficha: [] };
}
