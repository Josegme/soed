import type { FechaISO } from '../shared/fecha';
import type { Traducible } from '../shared/traducible';

/** Versión del esquema del reglamento (ADR-0006). Se incrementa ante cambios incompatibles. */
export const VERSION_ESQUEMA_REGLAMENTO = 1 as const;

export interface Categoria {
  readonly codigo: string;
  readonly nombre: Traducible;
  readonly edadMin: number;
  /** null = sin tope (por ejemplo, 40+). */
  readonly edadMax: number | null;
  /** Orden ascendente por edad; define "adyacentes" y "desde/hasta". */
  readonly orden: number;
}

/**
 * Cómo se determina la categoría de una formación:
 * - MAYOR: la categoría del integrante de mayor edad (solo, dúo, trío).
 * - TOLERANCIA_GRUPO: categoría declarada o deducida con tolerancia porcentual (grupos).
 */
export type CriterioCategoria = 'MAYOR' | 'TOLERANCIA_GRUPO';

export interface Formacion {
  readonly codigo: string;
  readonly nombre: Traducible;
  readonly integrantesMin: number;
  /** null = sin máximo. */
  readonly integrantesMax: number | null;
  /** Segundos permitidos por encima del tiempo máximo (preset: 30 grupos, 15 solo/dúo/trío). */
  readonly toleranciaTiempoSeg: number;
  readonly criterioCategoria: CriterioCategoria;
}

export interface Genero {
  readonly codigo: string;
  readonly nombre: Traducible;
  /** Si tiene elementos, solo esas categorías pueden competir en el género. */
  readonly categoriasHabilitadas?: readonly string[];
  /** Categoría mínima (inclusive) por orden de edad. */
  readonly desdeCategoria?: string;
  /** Categoría máxima (inclusive) por orden de edad. */
  readonly hastaCategoria?: string;
}

/** Regla de tiempo máximo. Gana la más específica (más campos definidos). */
export interface ReglaTiempo {
  readonly genero?: string;
  readonly formacion?: string;
  readonly categoria?: string;
  readonly maxSegundos: number;
}

export type Redondeo = 'FLOOR' | 'CEIL' | 'ROUND';
export type DireccionTolerancia = 'AMBAS' | 'SOLO_MENORES' | 'SOLO_MAYORES';

export interface ToleranciaGrupo {
  /** Porcentaje máximo de integrantes fuera de la categoría (preset: 30). */
  readonly porcentaje: number;
  readonly redondeo: Redondeo;
  /** Si los integrantes fuera de categoría pueden ser menores, mayores o ambos. */
  readonly direccion: DireccionTolerancia;
  /** Si los integrantes fuera de categoría solo pueden pertenecer a categorías adyacentes. */
  readonly soloAdyacentes: boolean;
}

export interface Banda {
  readonly codigo: string;
  readonly nombre: Traducible;
  /** Puntaje mínimo (inclusive). */
  readonly umbral: number;
}

export type Agregacion = 'PROMEDIO' | 'PROMEDIO_SIN_EXTREMOS';
export type CampoAgrupacion = 'categoria' | 'formacion' | 'genero';

export interface ConfigPuntaje {
  readonly escalaMin: number;
  readonly escalaMax: number;
  /** Decimales admitidos en cada nota. */
  readonly decimalesNota: number;
  /** Decimales del puntaje final. */
  readonly decimalesResultado: number;
  readonly agregacion: Agregacion;
  /** Diferencia a partir de la cual el director técnico recibe una alerta de desvío. */
  readonly umbralDesvio: number;
  /** Agrupación del ranking (preset: categoría + formación + género). */
  readonly agrupacionRanking: readonly CampoAgrupacion[];
}

export type FechaReferenciaEdad =
  | { readonly tipo: 'INICIO_EVENTO' }
  | { readonly tipo: 'FIN_EVENTO' }
  | { readonly tipo: 'FIN_DE_ANIO' }
  | { readonly tipo: 'FECHA_FIJA'; readonly fecha: FechaISO };

export interface ReglamentoEvento {
  readonly versionEsquema: typeof VERSION_ESQUEMA_REGLAMENTO;
  readonly preset?: string;
  readonly fechaReferenciaEdad: FechaReferenciaEdad;
  readonly categorias: readonly Categoria[];
  readonly formaciones: readonly Formacion[];
  readonly generos: readonly Genero[];
  readonly tiempos: readonly ReglaTiempo[];
  readonly toleranciaGrupo: ToleranciaGrupo;
  /** Ordenadas por umbral descendente. */
  readonly bandas: readonly Banda[];
  readonly puntaje: ConfigPuntaje;
  /** Rutas de parámetros no confirmados con el reglamento oficial (se muestran como pendientes). */
  readonly supuestos?: readonly string[];
}

export interface FechasEvento {
  readonly fechaInicio: FechaISO;
  readonly fechaFin: FechaISO;
}
