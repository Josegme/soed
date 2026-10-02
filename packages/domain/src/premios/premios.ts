import { repartir, type Dinero } from '../shared/dinero';
import type { PuestoFicha } from '../puntajes/puntajes';

export type ReglaEmpate = 'DIVIDIR_MONTO' | 'MONTO_COMPLETO_CADA_UNO';
export type CriterioAsignacion = 'MANUAL' | 'RANKING';

export interface Asignacion {
  readonly fichaId: string;
  readonly monto: Dinero | null;
}

/**
 * Reparte un premio entre fichas ganadoras (OR-43). Con DIVIDIR_MONTO el empate
 * divide el monto y los centavos sobrantes van a las primeras.
 */
export function repartirPremio(
  fichas: readonly string[],
  monto: Dinero | null,
  regla: ReglaEmpate,
): Asignacion[] {
  if (fichas.length === 0) return [];
  if (monto === null) return fichas.map((fichaId) => ({ fichaId, monto: null }));
  if (regla === 'MONTO_COMPLETO_CADA_UNO') return fichas.map((fichaId) => ({ fichaId, monto }));
  const partes = repartir(monto, fichas.length);
  return fichas.map((fichaId, i) => ({ fichaId, monto: partes[i] ?? null }));
}

/** Fichas en un puesto de un grupo del ranking, para premios con criterio RANKING. */
export function fichasEnPuesto(puestos: readonly PuestoFicha[], puesto: number, grupo?: string): string[] {
  return puestos.filter((p) => p.puesto === puesto && (grupo === undefined || p.grupo === grupo)).map((p) => p.fichaId);
}
