import { z } from 'zod';
import { idiomaSchema, traducibleSchema } from './comunes';

/**
 * Configuración de una instancia (ADR-0003). Se valida en build: el deploy falla
 * si está incompleta. Toda clave nueva lleva ADR y valor por defecto neutro.
 */
export const MODULOS = [
  'inscripciones',
  'liquidaciones',
  'ordenEnVivo',
  'puntajes',
  'acreditacion',
  'clases',
  'entradas',
  'hoteles',
  'comunicados',
  'pwa',
] as const;

export type Modulo = (typeof MODULOS)[number];

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'COLOR_HEX');

export const configClienteSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
    nombre: z.string().min(2).max(120),
    nombreCorto: z.string().min(2).max(30),
    descripcion: traducibleSchema,
    dominio: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'DOMINIO_INVALIDO'),
    idiomas: z.array(idiomaSchema).min(1),
    idiomaDefecto: idiomaSchema,
    zonaHorariaDefecto: z.string().min(3).max(64),
    modulos: z.partialRecord(z.enum(MODULOS), z.boolean()),
    email: z.object({
      remitente: z.email(),
      nombreRemitente: z.string().min(2).max(80),
      respuestaA: z.email().optional(),
    }),
    reglamentoPreset: z.string().regex(/^[a-z0-9-]+$/),
    marca: z.object({
      logo: z.string().startsWith('/cliente/'),
      logoAlt: z.string().min(2),
      favicon: z.string().startsWith('/cliente/'),
      /** Color de la barra del navegador móvil y del manifest PWA. */
      colorTema: hexColor,
    }),
    legal: z.object({
      razonSocial: z.string().min(2),
      contactoEmail: z.email(),
      terminos: traducibleSchema,
      privacidad: traducibleSchema,
    }),
    redes: z.object({ instagram: z.url().optional(), facebook: z.url().optional(), sitio: z.url().optional() }).default({}),
  })
  .refine((c) => c.idiomas.includes(c.idiomaDefecto), { message: 'IDIOMA_DEFECTO_NO_HABILITADO', path: ['idiomaDefecto'] });

export type ConfigCliente = z.infer<typeof configClienteSchema>;
export type ConfigClienteEntrada = z.input<typeof configClienteSchema>;

/** Ayuda de tipado para `clients/<slug>/client.config.ts`. */
export const definirCliente = (config: ConfigClienteEntrada): ConfigClienteEntrada => config;

export const moduloActivo = (config: ConfigCliente, modulo: Modulo): boolean => config.modulos[modulo] ?? false;
