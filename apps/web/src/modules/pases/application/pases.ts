import { err, errorDominio, ok, validarPase, type Beneficio, type ErrorDominio, type Result } from '@soed/domain';

export interface PuertosPase {
  puedeRegistrar(eventoOrigenId: string): boolean;
  /** Evento destino válido: otro evento de la misma temporada. */
  destinoValido(eventoOrigenId: string, eventoDestinoId: string): Promise<boolean>;
  coreografiaDeAcademia(coreografiaId: string, academiaId: string): Promise<boolean>;
  insertar(p: {
    eventoOrigenId: string;
    eventoDestinoId: string;
    academiaId: string;
    coreografiaId: string | null;
    motivo: string;
    beneficio: Beneficio | null;
  }): Promise<string>;
}

export type CodigoErrorPaseApp = 'SIN_PERMISO' | 'DESTINO_INVALIDO' | 'DESTINO_AMBIGUO' | 'MOTIVO_REQUERIDO' | 'BENEFICIO_INVALIDO' | 'COREOGRAFIA_AJENA';

/**
 * Registra un pase manual (OR-33, TR-13). La decisión es del organizador: el
 * sistema solo valida la forma y deja traza de quién, cuándo y por qué.
 */
export async function registrarPase(
  p: PuertosPase,
  e: { eventoOrigenId: string; eventoDestinoId: string; academiaId: string; coreografiaId?: string | null; motivo: string; beneficio?: Beneficio | null },
): Promise<Result<{ paseId: string }, ErrorDominio<CodigoErrorPaseApp>>> {
  if (!p.puedeRegistrar(e.eventoOrigenId)) return err(errorDominio('SIN_PERMISO'));
  if (!(await p.destinoValido(e.eventoOrigenId, e.eventoDestinoId))) return err(errorDominio('DESTINO_INVALIDO'));
  // El destino del pase es la coreografía (si se indica) o la academia completa.
  const destino = e.coreografiaId ? { coreografiaId: e.coreografiaId } : { academiaId: e.academiaId };
  const v = validarPase({ ...destino, eventoDestinoId: e.eventoDestinoId, motivo: e.motivo, beneficio: e.beneficio ?? null });
  if (!v.ok) return err(v.error);
  if (e.coreografiaId && !(await p.coreografiaDeAcademia(e.coreografiaId, e.academiaId))) return err(errorDominio('COREOGRAFIA_AJENA'));
  const paseId = await p.insertar({
    eventoOrigenId: e.eventoOrigenId,
    eventoDestinoId: e.eventoDestinoId,
    academiaId: e.academiaId,
    coreografiaId: e.coreografiaId ?? null,
    motivo: v.value.motivo,
    beneficio: e.beneficio ?? null,
  });
  return ok({ paseId });
}
