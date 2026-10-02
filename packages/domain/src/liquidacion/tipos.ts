import type { Moneda } from '../shared/dinero';
import type { Traducible } from '../shared/traducible';

/** Precios en centavos de la moneda del tarifario. */
export interface Tarifario {
  readonly moneda: Moneda;
  /** Precio por bailarín distinto inscripto en el evento. */
  readonly porBailarin?: { readonly precio: number };
  /** Precio por coreografía, con precio opcional distinto por formación. */
  readonly porCoreografia?: {
    readonly precioBase: number;
    readonly porFormacion?: Readonly<Record<string, number>>;
  };
  /**
   * Precio por participación de un bailarín en una coreografía, a partir de su
   * n-ésima participación (desdeNumero = 2 → coreografía extra, Art. 12).
   */
  readonly porParticipacion?: { readonly precio: number; readonly desdeNumero: number };
  /** Monto fijo por academia inscripta. */
  readonly fijoAcademia?: { readonly precio: number };
  /** Rubros que la academia elige (por ejemplo, competir por vestuario). */
  readonly rubros?: readonly RubroOpcional[];
  readonly recargos?: readonly Recargo[];
}

export interface RubroOpcional {
  readonly codigo: string;
  readonly nombre: Traducible;
  readonly precioUnitario: number;
}

interface RecargoBase {
  readonly codigo: string;
  readonly nombre: Traducible;
}

/** Filtro de coreografías a las que aplica un recargo (vacío = todas). */
export interface FiltroCoreografia {
  readonly formacion?: string;
  readonly genero?: string;
  readonly categoria?: string;
}

export type Recargo =
  | (RecargoBase & {
      /** Multiplica los cargos de la coreografía (Quadro cuesta como dos: factor 2). */
      readonly tipo: 'MULTIPLICADOR_COREOGRAFIA';
      readonly filtro: FiltroCoreografia;
      readonly factor: number;
    })
  | (RecargoBase & {
      readonly tipo: 'MONTO_POR_COREOGRAFIA';
      readonly filtro: FiltroCoreografia;
      readonly monto: number;
    })
  | (RecargoBase & {
      /** Monto por bailarín que cumple la condición (corégrafo que baila paga inscripción). */
      readonly tipo: 'MONTO_POR_BAILARIN';
      readonly condicion: 'ES_COREOGRAFO';
      readonly monto: number;
    });

/** Ajustes manuales del organizador o beneficios de un pase. */
export type Ajuste =
  | { readonly tipo: 'SIN_CARGO'; readonly motivo: string }
  | { readonly tipo: 'MONTO_LIBRE'; readonly monto: number; readonly motivo: string }
  | { readonly tipo: 'DESCUENTO_PORCENTAJE'; readonly porcentaje: number; readonly motivo: string }
  | { readonly tipo: 'DESCUENTO_MONTO'; readonly monto: number; readonly motivo: string };

export type EstadoFicha = 'BORRADOR' | 'ENVIADA' | 'OBSERVADA' | 'APROBADA' | 'RETIRADA';

export interface FichaALiquidar {
  readonly id: string;
  readonly formacion: string;
  readonly genero: string;
  readonly categoria: string | null;
  readonly estado: EstadoFicha;
  readonly integrantes: readonly { readonly bailarinId: string; readonly esCoreografo?: boolean }[];
}

export interface InscripcionALiquidar {
  readonly fichas: readonly FichaALiquidar[];
  readonly rubros: readonly { readonly codigo: string; readonly cantidad: number }[];
  readonly ajustes: readonly Ajuste[];
}

export type ConceptoLinea = 'POR_BAILARIN' | 'POR_COREOGRAFIA' | 'POR_PARTICIPACION' | 'FIJO_ACADEMIA' | 'RUBRO' | 'RECARGO' | 'AJUSTE';

export interface LineaLiquidacion {
  readonly concepto: ConceptoLinea;
  /** Ficha, rubro, recargo o tipo de ajuste al que corresponde la línea. */
  readonly referencia?: string;
  readonly cantidad: number;
  readonly precioUnitario: number;
  /** Centavos; negativo en descuentos. */
  readonly importe: number;
}

export interface CalculoLiquidacion {
  readonly moneda: Moneda;
  readonly lineas: readonly LineaLiquidacion[];
  readonly subtotal: number;
  readonly total: number;
}

export type EstadoLiquidacion = 'SIN_CARGO' | 'PENDIENTE' | 'PARCIAL' | 'PAGADA';
