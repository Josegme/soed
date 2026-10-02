import type { Ajuste, Tarifario } from '@soed/domain';
import { z } from 'zod';
import { centavosSchema, codigoSchema, monedaSchema, traducibleSchema } from './comunes';

const filtroSchema = z.object({
  formacion: codigoSchema.optional(),
  genero: codigoSchema.optional(),
  categoria: codigoSchema.optional(),
});

const recargoBase = { codigo: codigoSchema, nombre: traducibleSchema };

export const recargoSchema = z.discriminatedUnion('tipo', [
  z.object({ ...recargoBase, tipo: z.literal('MULTIPLICADOR_COREOGRAFIA'), filtro: filtroSchema, factor: z.number().positive().max(10) }),
  z.object({ ...recargoBase, tipo: z.literal('MONTO_POR_COREOGRAFIA'), filtro: filtroSchema, monto: centavosSchema }),
  z.object({ ...recargoBase, tipo: z.literal('MONTO_POR_BAILARIN'), condicion: z.literal('ES_COREOGRAFO'), monto: centavosSchema }),
]);

export const tarifarioSchema = z.object({
  moneda: monedaSchema,
  porBailarin: z.object({ precio: centavosSchema }).optional(),
  porCoreografia: z.object({ precioBase: centavosSchema, porFormacion: z.record(codigoSchema, centavosSchema).optional() }).optional(),
  porParticipacion: z.object({ precio: centavosSchema, desdeNumero: z.int().min(1).max(20) }).optional(),
  fijoAcademia: z.object({ precio: centavosSchema }).optional(),
  rubros: z
    .array(z.object({ codigo: codigoSchema, nombre: traducibleSchema, precioUnitario: centavosSchema }))
    .max(50)
    .optional(),
  recargos: z.array(recargoSchema).max(50).optional(),
}) satisfies z.ZodType<Tarifario>;

const motivo = z.string().trim().min(3).max(500);

export const ajusteSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('SIN_CARGO'), motivo }),
  z.object({ tipo: z.literal('MONTO_LIBRE'), monto: centavosSchema, motivo }),
  z.object({ tipo: z.literal('DESCUENTO_PORCENTAJE'), porcentaje: z.number().gt(0).max(100), motivo }),
  z.object({ tipo: z.literal('DESCUENTO_MONTO'), monto: centavosSchema, motivo }),
]) satisfies z.ZodType<Ajuste>;
