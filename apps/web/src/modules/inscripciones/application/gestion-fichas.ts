import { err, errorDominio, ok, type ErrorDominio, type Infraccion, type Result } from '@soed/domain';

export type AccionGestion =
  | { accion: 'APROBAR'; fichaId: string }
  | { accion: 'OBSERVAR'; fichaId: string; observacion: string }
  | { accion: 'BLOQUEAR'; fichaId: string; bloqueada: boolean }
  | { accion: 'EXCEPCION'; fichaId: string; motivo: string };

export interface FichaParaGestion {
  id: string;
  eventoId: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'OBSERVADA' | 'APROBADA' | 'RETIRADA';
  valida: boolean | null;
  tieneExcepcion: boolean;
  infracciones: readonly Infraccion[];
}

export interface PuertosGestionFicha {
  leer(fichaId: string): Promise<FichaParaGestion | null>;
  puedeGestionar(eventoId: string): boolean;
  usuarioId(): string;
  /** Escritura con el cliente del organizador (RLS + trigger de ficha). */
  actualizar(fichaId: string, cambios: Record<string, unknown>): Promise<void>;
}

export type CodigoErrorGestion = 'FICHA_INEXISTENTE' | 'SIN_PERMISO' | 'FICHA_RETIRADA' | 'FICHA_INVALIDA' | 'MOTIVO_REQUERIDO';

/**
 * Acciones del organizador sobre una ficha (OR-21, OR-22, OR-23):
 * - Aprobar solo fichas que cumplen o tienen excepción.
 * - La excepción guarda motivo, autor, fecha e infracciones vigentes, y deja
 *   la ficha enviada: el sistema no decide por el organizador.
 */
export async function gestionarFicha(p: PuertosGestionFicha, a: AccionGestion, ahora: Date): Promise<Result<true, ErrorDominio<CodigoErrorGestion>>> {
  const f = await p.leer(a.fichaId);
  if (!f) return err(errorDominio('FICHA_INEXISTENTE'));
  if (!p.puedeGestionar(f.eventoId)) return err(errorDominio('SIN_PERMISO'));
  if (f.estado === 'RETIRADA' && a.accion !== 'BLOQUEAR') return err(errorDominio('FICHA_RETIRADA'));
  switch (a.accion) {
    case 'APROBAR':
      if (f.valida !== true && !f.tieneExcepcion) return err(errorDominio('FICHA_INVALIDA'));
      await p.actualizar(f.id, { estado: 'APROBADA', observacion: null });
      break;
    case 'OBSERVAR':
      await p.actualizar(f.id, { estado: 'OBSERVADA', observacion: a.observacion.trim() });
      break;
    case 'BLOQUEAR':
      await p.actualizar(f.id, { bloqueada: a.bloqueada });
      break;
    case 'EXCEPCION': {
      if (a.motivo.trim().length < 5) return err(errorDominio('MOTIVO_REQUERIDO'));
      await p.actualizar(f.id, {
        excepcion: { motivo: a.motivo.trim(), por: p.usuarioId(), at: ahora.toISOString(), infracciones: f.infracciones.map((i) => i.codigo) },
        estado: f.estado === 'APROBADA' ? 'APROBADA' : 'ENVIADA',
      });
      break;
    }
  }
  return ok(true);
}
