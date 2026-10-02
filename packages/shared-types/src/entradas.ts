import { ESTADOS_ORDEN, MEDIOS_COBRO_DEFECTO } from '@soed/domain';
import { z } from 'zod';
import {
  centavosSchema,
  codigoSchema,
  fechaISOSchema,
  idiomaSchema,
  instanteSchema,
  monedaSchema,
  traducibleRequeridoSchema,
  traducibleSchema,
  uuidSchema,
} from './comunes';
import { tarifarioSchema } from './tarifario';

/**
 * Entradas de los casos de uso. Todo dato que llega desde el navegador se valida
 * con estos schemas en el borde (server actions y route handlers, TR-31).
 * Los mensajes son códigos que la interfaz traduce.
 */
const texto = (max: number) => z.string().trim().min(1, 'REQUERIDO').max(max, 'MUY_LARGO');
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, 'MUY_LARGO')
    .optional()
    .transform((v) => (v ? v : undefined));

// Identidad
export const registroSchema = z.object({
  nombre: texto(120),
  email: z.email('EMAIL_INVALIDO'),
  password: z.string().min(10, 'PASSWORD_CORTA').max(128),
  idioma: idiomaSchema,
});
export const ingresoSchema = z.object({ email: z.email('EMAIL_INVALIDO'), password: z.string().min(1, 'REQUERIDO') });
export const magicLinkSchema = z.object({ email: z.email('EMAIL_INVALIDO') });
export const perfilSchema = z.object({ nombre: texto(120), telefono: textoOpcional(40), idioma: idiomaSchema });

// Academia
export const academiaSchema = z.object({
  nombre: z.string().trim().min(2, 'MUY_CORTO').max(200),
  ciudad: textoOpcional(120),
  region: textoOpcional(120),
  pais: textoOpcional(80),
  email: z
    .email('EMAIL_INVALIDO')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  telefono: textoOpcional(40),
});

export const bailarinSchema = z.object({
  nombre: texto(120),
  apellido: texto(120),
  fechaNacimiento: fechaISOSchema,
  documentoTipo: textoOpcional(20),
  documentoNumero: textoOpcional(40),
});

export const coreografiaSchema = z.object({
  nombre: texto(200),
  genero: codigoSchema,
  formacion: codigoSchema,
  coreografo: textoOpcional(200),
  elenco: z
    .array(z.object({ bailarinId: uuidSchema, esCoreografo: z.boolean().default(false) }))
    .max(200)
    .refine((e) => new Set(e.map((i) => i.bailarinId)).size === e.length, 'INTEGRANTE_DUPLICADO'),
});

export const musicaSchema = z.object({
  coreografiaId: uuidSchema,
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[\w.-]{1,120}$/i, 'RUTA_INVALIDA'),
  nombre: texto(255),
  duracionSegundos: z.int().min(1).max(3600),
});

// Inscripciones
export const inscribirAcademiaSchema = z.object({ eventoId: uuidSchema, academiaId: uuidSchema });
export const inscribirFichaSchema = z.object({
  eventoId: uuidSchema,
  academiaId: uuidSchema,
  coreografiaId: uuidSchema,
  categoriaDeclarada: codigoSchema.nullable().optional(),
});
export const enviarFichaSchema = z.object({ fichaId: uuidSchema });
export const rubrosSchema = z.object({
  inscripcionId: uuidSchema,
  rubros: z.array(z.object({ codigo: codigoSchema, cantidad: z.int().min(0).max(1000) })).max(50),
});
export const gestionFichaSchema = z.discriminatedUnion('accion', [
  z.object({ accion: z.literal('APROBAR'), fichaId: uuidSchema }),
  z.object({ accion: z.literal('OBSERVAR'), fichaId: uuidSchema, observacion: texto(2000) }),
  z.object({ accion: z.literal('BLOQUEAR'), fichaId: uuidSchema, bloqueada: z.boolean() }),
  z.object({ accion: z.literal('EXCEPCION'), fichaId: uuidSchema, motivo: z.string().trim().min(5).max(1000) }),
]);
export const solicitudModificacionSchema = z.object({ fichaId: uuidSchema, descripcion: z.string().trim().min(5).max(4000) });

// Cobros (ADR-0009, ADR-0010)
export const registrarCobroSchema = z.object({
  liquidacionId: uuidSchema,
  montoCentavos: centavosSchema.refine((v) => v > 0, 'MONTO_INVALIDO'),
  moneda: monedaSchema,
  medio: z
    .string()
    .regex(/^[A-Z_]{2,30}$/)
    .default(MEDIOS_COBRO_DEFECTO[0]),
  referencia: textoOpcional(200),
  nota: textoOpcional(1000),
  clientUuid: uuidSchema,
  dispositivoAt: instanteSchema.optional(),
});
export const anularCobroSchema = z.object({ cobroId: uuidSchema, motivo: z.string().trim().min(3, 'MOTIVO_REQUERIDO').max(500) });

// Pases
export const beneficioSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('DESCUENTO_PORCENTAJE'), porcentaje: z.number().gt(0).max(100) }),
  z.object({ tipo: z.literal('DESCUENTO_MONTO'), montoCentavos: centavosSchema.refine((v) => v > 0) }),
  z.object({ tipo: z.literal('BECA') }),
]);
export const registrarPaseSchema = z.object({
  eventoOrigenId: uuidSchema,
  eventoDestinoId: uuidSchema,
  academiaId: uuidSchema,
  coreografiaId: uuidSchema.nullable().optional(),
  motivo: z.string().trim().min(3, 'MOTIVO_REQUERIDO').max(1000),
  beneficio: beneficioSchema.nullable().optional(),
});

// Orden y puntajes
export const reordenarSchema = z.object({ itemId: uuidSchema, bloqueId: uuidSchema, posicion: z.int().min(1) });
export const cambiarEstadoOrdenSchema = z.object({ itemId: uuidSchema, estado: z.enum(ESTADOS_ORDEN) });
export const guardarPlanillaSchema = z.object({
  fichaId: uuidSchema,
  notas: z.array(z.object({ criterioId: uuidSchema, valor: z.number().min(0).max(1000) })).max(30),
  comentario: textoOpcional(4000),
  enviar: z.boolean(),
  clientUuid: uuidSchema,
});
export const reabrirPlanillaSchema = z.object({ planillaId: uuidSchema, motivo: z.string().trim().min(3).max(500) });

// Acreditación
export const acreditarSchema = z.object({
  qrToken: z.string().regex(/^[0-9a-f]{32}$/, 'QR_INVALIDO'),
  clientUuid: uuidSchema,
  dispositivoAt: instanteSchema.optional(),
});

// Eventos (Super Admin y organizador)
export const sedeSchema = z.object({
  venue: textoOpcional(200),
  ciudad: textoOpcional(120),
  region: textoOpcional(120),
  pais: textoOpcional(80),
  direccion: textoOpcional(300),
});
export const crearEventoSchema = z
  .object({
    temporadaId: uuidSchema,
    slug: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,16}$/, 'SLUG_INVALIDO'),
    tipo: z.enum(['SELECTIVO', 'FINAL', 'UNICO']),
    nombre: traducibleRequeridoSchema,
    moneda: monedaSchema,
    idiomaDefecto: idiomaSchema,
    zonaHoraria: z.string().min(3).max(64),
    fechaInicio: fechaISOSchema,
    fechaFin: fechaISOSchema,
    sede: sedeSchema,
    clonarDeEventoId: uuidSchema.optional(),
  })
  .refine((e) => e.fechaFin >= e.fechaInicio, { message: 'FECHAS_INVALIDAS', path: ['fechaFin'] });
export const ventanaInscripcionSchema = z
  .object({
    eventoId: uuidSchema,
    apertura: instanteSchema.nullable(),
    cierre: instanteSchema.nullable(),
    cierreModificaciones: instanteSchema.nullable(),
    cupoFichas: z.int().positive().nullable(),
  })
  .refine((v) => !v.apertura || !v.cierre || v.cierre > v.apertura, { message: 'VENTANA_INVALIDA', path: ['cierre'] })
  .refine((v) => !v.cierre || !v.cierreModificaciones || v.cierreModificaciones >= v.cierre, {
    message: 'VENTANA_INVALIDA',
    path: ['cierreModificaciones'],
  });
export const tarifarioEventoSchema = z.object({
  eventoId: uuidSchema,
  tarifario: tarifarioSchema,
  mediosCobro: z.array(z.string().regex(/^[A-Z_]{2,30}$/)).min(1),
  datosPago: traducibleSchema,
});
export const miembroEventoSchema = z.object({
  eventoId: uuidSchema,
  email: z.email('EMAIL_INVALIDO'),
  rol: z.string().regex(/^[A-Z_]+$/),
});
export const comunicadoSchema = z.object({
  eventoId: uuidSchema,
  asunto: traducibleRequeridoSchema,
  cuerpo: traducibleRequeridoSchema,
  audiencia: z.array(z.enum(['ACADEMIAS', 'JURADOS', 'STAFF'])).min(1),
});

// Público (sin sesión): reservas con cobro manual (F6)
export const reservaEntradaSchema = z.object({
  entradaTipoId: uuidSchema,
  nombre: texto(200),
  email: z.email('EMAIL_INVALIDO'),
  cantidad: z.int().min(1).max(20),
  /** Honeypot anti-bots: debe llegar vacío. */
  sitioWeb: z.literal('').optional(),
});
