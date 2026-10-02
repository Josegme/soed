/**
 * Códigos estables de infracción del reglamento. La interfaz los traduce con
 * claves `reglamento.infraccion.<CODIGO>` (ADR-0005).
 */
export const CODIGOS_INFRACCION = [
  'FORMACION_DESCONOCIDA',
  'GENERO_DESCONOCIDO',
  'CATEGORIA_DESCONOCIDA',
  'INTEGRANTES_INSUFICIENTES',
  'INTEGRANTES_EXCEDIDOS',
  'INTEGRANTE_DUPLICADO',
  'INTEGRANTE_SIN_CATEGORIA',
  'CATEGORIA_NO_DETERMINADA',
  'CATEGORIA_NO_COINCIDE',
  'TOLERANCIA_GRUPO_EXCEDIDA',
  'INTEGRANTE_CATEGORIA_NO_ADYACENTE',
  'INTEGRANTE_FUERA_DE_DIRECCION',
  'GENERO_NO_HABILITADO_EN_CATEGORIA',
  'MUSICA_FALTANTE',
  'DURACION_EXCEDIDA',
  'DURACION_EN_TOLERANCIA',
  'SIN_TIEMPO_MAXIMO',
] as const;

export type CodigoInfraccion = (typeof CODIGOS_INFRACCION)[number];

export interface Infraccion {
  readonly codigo: CodigoInfraccion;
  readonly params?: Readonly<Record<string, string | number>>;
}

export const infraccion = (codigo: CodigoInfraccion, params?: Record<string, string | number>): Infraccion =>
  params === undefined ? { codigo } : { codigo, params };
