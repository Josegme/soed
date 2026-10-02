/**
 * Acreditación (F5). Regla innegociable (TR-12, OP-25): la deuda nunca bloquea
 * la acreditación. Estas funciones no reciben datos de cobro a propósito.
 */
export interface Credencial {
  readonly id: string;
  readonly zonas: readonly string[];
  readonly acreditadoAt: string | null;
  readonly anulada: boolean;
}

export type ResultadoAcreditacion =
  | { readonly tipo: 'ACREDITADO'; readonly at: string }
  | { readonly tipo: 'YA_ACREDITADO'; readonly at: string }
  | { readonly tipo: 'CREDENCIAL_ANULADA' };

/** Acreditar es idempotente: un segundo escaneo informa la hora del primero (OP-17, OP-22). */
export function acreditar(credencial: Credencial, ahora: string): ResultadoAcreditacion {
  if (credencial.anulada) return { tipo: 'CREDENCIAL_ANULADA' };
  if (credencial.acreditadoAt) return { tipo: 'YA_ACREDITADO', at: credencial.acreditadoAt };
  return { tipo: 'ACREDITADO', at: ahora };
}

/** Control de acceso por zona (OP-24). Una credencial sin zonas no accede a zonas restringidas. */
export const puedeAcceder = (credencial: Credencial, zona: string): boolean => !credencial.anulada && credencial.zonas.includes(zona);

export const TIPOS_CREDENCIAL = ['BAILARIN', 'PROFESOR', 'STAFF', 'JURADO', 'ACOMPANANTE'] as const;
export type TipoCredencial = (typeof TIPOS_CREDENCIAL)[number];

/** Configuración de acreditación del evento (jsonb `evento.acreditacion`). */
export interface ConfigAcreditacion {
  readonly zonasPorTipo?: Partial<Readonly<Record<TipoCredencial, readonly string[]>>>;
}

export interface CandidatoCredencial {
  readonly tipo: TipoCredencial;
  readonly nombre: string;
  readonly academiaId?: string | null;
  readonly bailarinId?: string | null;
  readonly usuarioId?: string | null;
}

export interface CredencialExistente {
  readonly tipo: TipoCredencial;
  readonly bailarinId: string | null;
  readonly usuarioId: string | null;
}

export interface CredencialNueva extends CandidatoCredencial {
  readonly zonas: readonly string[];
}

const claveCandidato = (c: { tipo: string; bailarinId?: string | null; usuarioId?: string | null }) =>
  c.bailarinId ? `B:${c.bailarinId}` : `U:${c.tipo}:${c.usuarioId ?? ''}`;

/**
 * Credenciales a emitir (OR-50, OP-15): una por bailarín inscripto y una por
 * persona y tipo; nunca duplica las ya emitidas. Las zonas salen de la
 * configuración del evento. El estado de pago no interviene (TR-12).
 */
export function planCredenciales(
  candidatos: readonly CandidatoCredencial[],
  existentes: readonly CredencialExistente[],
  config: ConfigAcreditacion,
): CredencialNueva[] {
  const vistas = new Set(existentes.map(claveCandidato));
  const nuevas: CredencialNueva[] = [];
  for (const c of candidatos) {
    if (!c.bailarinId && !c.usuarioId) continue;
    const clave = claveCandidato(c);
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    nuevas.push({ ...c, zonas: config.zonasPorTipo?.[c.tipo] ?? [] });
  }
  return nuevas;
}
