import { VERSION_ESQUEMA_REGLAMENTO, validarReglamento, type ReglamentoEvento } from '@soed/domain';
import { z } from 'zod';
import { codigoSchema, fechaISOSchema, traducibleSchema } from './comunes';

const categoriaSchema = z.object({
  codigo: codigoSchema,
  nombre: traducibleSchema,
  edadMin: z.int().min(0).max(130),
  edadMax: z.int().min(0).max(130).nullable(),
  orden: z.int(),
});

const formacionSchema = z.object({
  codigo: codigoSchema,
  nombre: traducibleSchema,
  integrantesMin: z.int().min(1),
  integrantesMax: z.int().min(1).nullable(),
  toleranciaTiempoSeg: z.int().min(0).max(600),
  criterioCategoria: z.enum(['MAYOR', 'TOLERANCIA_GRUPO']),
});

const generoSchema = z.object({
  codigo: codigoSchema,
  nombre: traducibleSchema,
  categoriasHabilitadas: z.array(codigoSchema).optional(),
  desdeCategoria: codigoSchema.optional(),
  hastaCategoria: codigoSchema.optional(),
});

const reglaTiempoSchema = z.object({
  genero: codigoSchema.optional(),
  formacion: codigoSchema.optional(),
  categoria: codigoSchema.optional(),
  maxSegundos: z.int().min(1).max(3600),
});

const fechaReferenciaSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('INICIO_EVENTO') }),
  z.object({ tipo: z.literal('FIN_EVENTO') }),
  z.object({ tipo: z.literal('FIN_DE_ANIO') }),
  z.object({ tipo: z.literal('FECHA_FIJA'), fecha: fechaISOSchema }),
]);

/**
 * Schema del reglamento (ADR-0006). Valida la forma con Zod y la coherencia
 * interna con el dominio (`validarReglamento`); los errores del dominio se
 * reportan con su código.
 */
export const reglamentoSchema = z
  .object({
    versionEsquema: z.literal(VERSION_ESQUEMA_REGLAMENTO),
    preset: z.string().max(60).optional(),
    fechaReferenciaEdad: fechaReferenciaSchema,
    categorias: z.array(categoriaSchema).max(40),
    formaciones: z.array(formacionSchema).max(20),
    generos: z.array(generoSchema).max(80),
    tiempos: z.array(reglaTiempoSchema).max(400),
    toleranciaGrupo: z.object({
      porcentaje: z.number().min(0).max(100),
      redondeo: z.enum(['FLOOR', 'CEIL', 'ROUND']),
      direccion: z.enum(['AMBAS', 'SOLO_MENORES', 'SOLO_MAYORES']),
      soloAdyacentes: z.boolean(),
    }),
    bandas: z.array(z.object({ codigo: codigoSchema, nombre: traducibleSchema, umbral: z.number() })).max(10),
    puntaje: z.object({
      escalaMin: z.number(),
      escalaMax: z.number(),
      decimalesNota: z.int().min(0).max(3),
      decimalesResultado: z.int().min(0).max(4),
      agregacion: z.enum(['PROMEDIO', 'PROMEDIO_SIN_EXTREMOS']),
      umbralDesvio: z.number().min(0),
      agrupacionRanking: z.array(z.enum(['categoria', 'formacion', 'genero'])),
    }),
    supuestos: z.array(z.string()).optional(),
  })
  .superRefine((r, ctx) => {
    for (const e of validarReglamento(r as ReglamentoEvento)) {
      ctx.addIssue({ code: 'custom', message: e.codigo, params: e.params });
    }
  }) satisfies z.ZodType<ReglamentoEvento>;
