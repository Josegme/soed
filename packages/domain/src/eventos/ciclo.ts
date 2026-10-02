import { err, errorDominio, ok, type ErrorDominio, type Result } from '../shared/result';

export const ESTADOS_EVENTO = ['BORRADOR', 'PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'ARCHIVADO'] as const;
export type EstadoEvento = (typeof ESTADOS_EVENTO)[number];

/**
 * Ciclo de vida del evento (OR-02, SA-08). Publicar lo hace visible en el sitio;
 * archivar lo congela (solo Super Admin). Volver atrás solo se admite donde no
 * rompe datos ya comunicados (p. ej. un evento finalizado puede reabrirse).
 */
const TRANSICIONES: Readonly<Record<EstadoEvento, readonly EstadoEvento[]>> = {
  BORRADOR: ['PUBLICADO'],
  PUBLICADO: ['BORRADOR', 'EN_CURSO'],
  EN_CURSO: ['PUBLICADO', 'FINALIZADO'],
  FINALIZADO: ['EN_CURSO', 'ARCHIVADO'],
  ARCHIVADO: ['FINALIZADO'],
};

const SOLO_SUPER_ADMIN: ReadonlySet<EstadoEvento> = new Set(['ARCHIVADO']);

export type CodigoErrorCicloEvento = 'TRANSICION_INVALIDA' | 'SOLO_SUPER_ADMIN';

export function transicionEvento(
  desde: EstadoEvento,
  hacia: EstadoEvento,
  esSuperAdmin: boolean,
): Result<{ estado: EstadoEvento; publicado: boolean }, ErrorDominio<CodigoErrorCicloEvento>> {
  if (!TRANSICIONES[desde].includes(hacia)) return err(errorDominio('TRANSICION_INVALIDA', { desde, hacia }));
  if ((SOLO_SUPER_ADMIN.has(hacia) || SOLO_SUPER_ADMIN.has(desde)) && !esSuperAdmin) return err(errorDominio('SOLO_SUPER_ADMIN'));
  return ok({ estado: hacia, publicado: hacia !== 'BORRADOR' && hacia !== 'ARCHIVADO' });
}

export function transicionesPosibles(desde: EstadoEvento, esSuperAdmin: boolean): EstadoEvento[] {
  return TRANSICIONES[desde].filter((h) => transicionEvento(desde, h, esSuperAdmin).ok);
}
