/**
 * Montos en unidades menores (centavos) como enteros. Nunca float para dinero.
 */
export const MONEDAS = ['BRL', 'ARS', 'USD'] as const;
export type Moneda = (typeof MONEDAS)[number];

export interface Dinero {
  readonly centavos: number;
  readonly moneda: Moneda;
}

export function esMoneda(valor: string): valor is Moneda {
  return (MONEDAS as readonly string[]).includes(valor);
}

export function dinero(centavos: number, moneda: Moneda): Dinero {
  if (!Number.isSafeInteger(centavos)) {
    throw new Error(`Monto inválido: ${centavos} (se esperan centavos enteros)`);
  }
  return { centavos, moneda };
}

export const cero = (moneda: Moneda): Dinero => dinero(0, moneda);

function mismaMoneda(a: Dinero, b: Dinero): void {
  if (a.moneda !== b.moneda) throw new Error(`Monedas distintas: ${a.moneda} y ${b.moneda}`);
}

export function sumar(a: Dinero, b: Dinero): Dinero {
  mismaMoneda(a, b);
  return dinero(a.centavos + b.centavos, a.moneda);
}

export function restar(a: Dinero, b: Dinero): Dinero {
  mismaMoneda(a, b);
  return dinero(a.centavos - b.centavos, a.moneda);
}

/** Multiplica y redondea al centavo (mitad hacia arriba, simétrico). */
export function multiplicar(a: Dinero, factor: number): Dinero {
  const bruto = a.centavos * factor;
  const redondeado = Math.sign(bruto) * Math.round(Math.abs(bruto) + Number.EPSILON);
  return dinero(redondeado === 0 ? 0 : redondeado, a.moneda);
}

export function sumarTodos(montos: readonly Dinero[], moneda: Moneda): Dinero {
  return montos.reduce((acc, m) => sumar(acc, m), cero(moneda));
}

export function maximo(a: Dinero, b: Dinero): Dinero {
  mismaMoneda(a, b);
  return a.centavos >= b.centavos ? a : b;
}

/**
 * Reparte un monto en n partes iguales; los centavos sobrantes van a las
 * primeras partes para que la suma sea exacta.
 */
export function repartir(total: Dinero, partes: number): Dinero[] {
  if (!Number.isInteger(partes) || partes <= 0) throw new Error('partes debe ser un entero positivo');
  const base = Math.trunc(total.centavos / partes);
  const resto = total.centavos - base * partes;
  return Array.from({ length: partes }, (_, i) => dinero(base + (i < resto ? 1 : 0), total.moneda));
}
