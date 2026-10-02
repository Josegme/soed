import { err, errorDominio, ok, traducir, type ErrorDominio, type Idioma, type Result, type Traducible } from '@soed/domain';

export type Audiencia = 'ACADEMIAS' | 'JURADOS' | 'STAFF';

export interface Destinatario {
  usuarioId: string;
  email: string;
  idioma: Idioma;
}

export interface EmailPreparado {
  usuarioId: string;
  destinatario: string;
  idioma: Idioma;
  asunto: string;
  cuerpo: string;
}

export interface PuertosComunicados {
  puedeEnviar(eventoId: string): boolean;
  idiomaDefecto(eventoId: string): Promise<Idioma>;
  destinatarios(eventoId: string, audiencia: readonly Audiencia[]): Promise<Destinatario[]>;
  guardarComunicado(c: { eventoId: string; asunto: Traducible; cuerpo: Traducible; audiencia: Audiencia[] }): Promise<string>;
  /** Encola los emails (ADR-0013). En desarrollo y preview quedan como SIMULADO. */
  encolar(eventoId: string, comunicadoId: string, emails: EmailPreparado[]): Promise<void>;
}

export type CodigoErrorComunicado = 'SIN_PERMISO' | 'SIN_DESTINATARIOS';

/**
 * Envía un comunicado bilingüe (OR-47): cada destinatario lo recibe en el idioma
 * de su perfil; si falta esa traducción, en el idioma por defecto del evento.
 * Un mismo email recibe un único mensaje aunque tenga varios roles.
 */
export async function enviarComunicado(
  p: PuertosComunicados,
  c: { eventoId: string; asunto: Traducible; cuerpo: Traducible; audiencia: Audiencia[] },
): Promise<Result<{ comunicadoId: string; enviados: number; porIdioma: Partial<Record<Idioma, number>> }, ErrorDominio<CodigoErrorComunicado>>> {
  if (!p.puedeEnviar(c.eventoId)) return err(errorDominio('SIN_PERMISO'));
  const defecto = await p.idiomaDefecto(c.eventoId);
  const unicos = new Map<string, Destinatario>();
  for (const d of await p.destinatarios(c.eventoId, c.audiencia)) {
    if (d.email && !unicos.has(d.email.toLowerCase())) unicos.set(d.email.toLowerCase(), d);
  }
  if (unicos.size === 0) return err(errorDominio('SIN_DESTINATARIOS'));
  const comunicadoId = await p.guardarComunicado(c);
  const porIdioma: Partial<Record<Idioma, number>> = {};
  const emails = [...unicos.values()].map((d) => {
    porIdioma[d.idioma] = (porIdioma[d.idioma] ?? 0) + 1;
    return {
      usuarioId: d.usuarioId,
      destinatario: d.email,
      idioma: d.idioma,
      asunto: traducir(c.asunto, d.idioma, defecto).texto,
      cuerpo: traducir(c.cuerpo, d.idioma, defecto).texto,
    };
  });
  await p.encolar(c.eventoId, comunicadoId, emails);
  return ok({ comunicadoId, enviados: emails.length, porIdioma });
}
