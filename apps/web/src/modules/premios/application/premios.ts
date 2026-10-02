import {
  dinero,
  err,
  errorDominio,
  fichasEnPuesto,
  ok,
  repartirPremio,
  type CriterioAsignacion,
  type ErrorDominio,
  type Moneda,
  type PuestoFicha,
  type ReglaEmpate,
  type Result,
} from '@soed/domain';

export interface PremioLeido {
  id: string;
  eventoId: string | null;
  montoCentavos: number | null;
  moneda: Moneda | null;
  criterio: CriterioAsignacion;
  reglaEmpate: ReglaEmpate;
  /** Para RANKING: puesto (por defecto 1) y grupo opcional (categoría|formación|género). */
  filtro: { puesto?: number; grupo?: string };
}

export interface PuertosPremio {
  premio(premioId: string): Promise<PremioLeido | null>;
  puedeAsignar(eventoId: string): boolean;
  ranking(eventoId: string): Promise<PuestoFicha[]>;
  fichas(eventoId: string, fichaIds: readonly string[]): Promise<{ id: string; academiaId: string }[]>;
  /** Reemplaza las asignaciones del premio (una asignación vigente por premio y ficha). */
  reemplazarAsignaciones(
    premioId: string,
    eventoId: string,
    asignaciones: { fichaId: string; academiaId: string; montoCentavos: number | null }[],
  ): Promise<void>;
}

export type CodigoErrorPremio = 'PREMIO_INEXISTENTE' | 'SIN_PERMISO' | 'SIN_GANADORES' | 'FICHA_AJENA' | 'PREMIO_DE_TEMPORADA';

/**
 * Asigna un premio (OR-43): manual (fichas elegidas por la organización) o por
 * ranking (puesto del grupo). Con empate y DIVIDIR_MONTO el monto se reparte
 * sin perder centavos. Reasignar reemplaza la asignación anterior.
 */
export async function asignarPremio(
  p: PuertosPremio,
  e: { premioId: string; fichaIds?: readonly string[]; eventoId?: string },
): Promise<Result<{ asignadas: number }, ErrorDominio<CodigoErrorPremio>>> {
  const premio = await p.premio(e.premioId);
  if (!premio) return err(errorDominio('PREMIO_INEXISTENTE'));
  const eventoId = premio.eventoId ?? e.eventoId;
  if (!eventoId) return err(errorDominio('PREMIO_DE_TEMPORADA'));
  if (!p.puedeAsignar(eventoId)) return err(errorDominio('SIN_PERMISO'));

  const ganadoras =
    premio.criterio === 'RANKING'
      ? fichasEnPuesto(await p.ranking(eventoId), premio.filtro.puesto ?? 1, premio.filtro.grupo)
      : [...new Set(e.fichaIds ?? [])];
  if (ganadoras.length === 0) return err(errorDominio('SIN_GANADORES'));
  const fichas = await p.fichas(eventoId, ganadoras);
  if (fichas.length !== ganadoras.length) return err(errorDominio('FICHA_AJENA'));

  const monto = premio.montoCentavos !== null && premio.moneda ? dinero(premio.montoCentavos, premio.moneda) : null;
  const reparto = repartirPremio(ganadoras, monto, premio.reglaEmpate);
  const academia = new Map(fichas.map((f) => [f.id, f.academiaId]));
  await p.reemplazarAsignaciones(
    premio.id,
    eventoId,
    reparto.map((a) => ({ fichaId: a.fichaId, academiaId: academia.get(a.fichaId)!, montoCentavos: a.monto?.centavos ?? null })),
  );
  return ok({ asignadas: reparto.length });
}
