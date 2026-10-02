import type { EstadoFormulario } from './formularios';

/**
 * Traduce un error de Postgres/PostgREST (códigos de nuestros triggers en
 * MAYÚSCULAS) o de un adaptador a un código de interfaz traducible. Nunca
 * expone mensajes internos al usuario.
 */
export function codigoDeError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'INESPERADO';
  const { message, code } = error as { message?: string; code?: string };
  if (message && /^[A-Z_]+$/.test(message)) return message;
  if (code === '42501' || /row-level security/i.test(message ?? '')) return 'SIN_PERMISO';
  if (code === '23505') return 'DUPLICADO';
  return 'INESPERADO';
}

/** Ejecuta una acción de escritura y convierte excepciones de adaptadores en estado de formulario. */
export async function intentar(fn: () => Promise<EstadoFormulario>, valores?: Record<string, string>): Promise<EstadoFormulario> {
  try {
    return await fn();
  } catch (e) {
    const codigo = codigoDeError(e);
    if (codigo === 'INESPERADO') console.error('[accion]', e);
    return { ok: false, mensaje: codigo, valores };
  }
}
