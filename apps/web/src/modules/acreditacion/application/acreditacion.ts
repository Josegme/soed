import {
  acreditar,
  err,
  errorDominio,
  ok,
  planCredenciales,
  type CandidatoCredencial,
  type ConfigAcreditacion,
  type CredencialExistente,
  type CredencialNueva,
  type ErrorDominio,
  type Result,
  type TipoCredencial,
} from '@soed/domain';

export interface CredencialLeida {
  id: string;
  eventoId: string;
  tipo: TipoCredencial;
  nombre: string;
  academia: string | null;
  zonas: string[];
  acreditadoAt: string | null;
  anulada: boolean;
}

export interface PuertosAcreditacion {
  puede(eventoId: string): boolean;
  credencialPorToken(token: string): Promise<CredencialLeida | null>;
  /** Registro ya procesado con este client_uuid (reintento offline). */
  registroPorClientUuid(clientUuid: string): Promise<{ credencialId: string } | null>;
  registrar(d: { credencialId: string; eventoId: string; clientUuid: string; dispositivoAt: string | null }): Promise<void>;
  // Emisión
  configuracion(eventoId: string): Promise<ConfigAcreditacion>;
  candidatos(eventoId: string): Promise<CandidatoCredencial[]>;
  existentes(eventoId: string): Promise<CredencialExistente[]>;
  emitir(eventoId: string, nuevas: CredencialNueva[]): Promise<void>;
}

export type CodigoErrorAcreditacion = 'SIN_PERMISO' | 'CREDENCIAL_INEXISTENTE' | 'CREDENCIAL_ANULADA';

export interface ResultadoAcreditacionApp {
  resultado: 'ACREDITADO' | 'YA_ACREDITADO';
  at: string;
  credencial: Pick<CredencialLeida, 'id' | 'tipo' | 'nombre' | 'academia' | 'zonas'>;
}

/**
 * Acredita por token de QR (OP-16, OP-17). Idempotente por client_uuid y por
 * credencial. La deuda de la academia no se consulta: nunca bloquea (TR-12).
 */
export async function acreditarPorToken(
  p: PuertosAcreditacion,
  e: { qrToken: string; clientUuid: string; dispositivoAt?: string | null },
  ahora: Date,
): Promise<Result<ResultadoAcreditacionApp, ErrorDominio<CodigoErrorAcreditacion>>> {
  const credencial = await p.credencialPorToken(e.qrToken);
  if (!credencial) return err(errorDominio('CREDENCIAL_INEXISTENTE'));
  if (!p.puede(credencial.eventoId)) return err(errorDominio('SIN_PERMISO'));
  const datos = {
    id: credencial.id,
    tipo: credencial.tipo,
    nombre: credencial.nombre,
    academia: credencial.academia,
    zonas: credencial.zonas,
  };
  if (await p.registroPorClientUuid(e.clientUuid)) {
    return ok({ resultado: 'ACREDITADO', at: credencial.acreditadoAt ?? ahora.toISOString(), credencial: datos });
  }
  const r = acreditar(credencial, e.dispositivoAt ?? ahora.toISOString());
  if (r.tipo === 'CREDENCIAL_ANULADA') return err(errorDominio('CREDENCIAL_ANULADA'));
  if (r.tipo === 'YA_ACREDITADO') return ok({ resultado: 'YA_ACREDITADO', at: r.at, credencial: datos });
  await p.registrar({
    credencialId: credencial.id,
    eventoId: credencial.eventoId,
    clientUuid: e.clientUuid,
    dispositivoAt: e.dispositivoAt ?? null,
  });
  return ok({ resultado: 'ACREDITADO', at: r.at, credencial: datos });
}

/** Emite las credenciales que faltan (bailarines inscriptos, profesores y equipo). Repetible sin duplicar. */
export async function emitirCredenciales(
  p: PuertosAcreditacion,
  eventoId: string,
): Promise<Result<{ emitidas: number }, ErrorDominio<CodigoErrorAcreditacion>>> {
  if (!p.puede(eventoId)) return err(errorDominio('SIN_PERMISO'));
  const [config, candidatos, existentes] = await Promise.all([p.configuracion(eventoId), p.candidatos(eventoId), p.existentes(eventoId)]);
  const nuevas = planCredenciales(candidatos, existentes, config);
  if (nuevas.length > 0) await p.emitir(eventoId, nuevas);
  return ok({ emitidas: nuevas.length });
}
