/**
 * Ruta interna segura para volver después del login (`?siguiente=`). Rechaza
 * URLs absolutas, protocolos y rutas `//host` (open redirect).
 */
export function rutaInternaSegura(valor: unknown): string | null {
  if (typeof valor !== 'string' || valor.length > 300) return null;
  return /^\/(?![/\\])[\w\-./~%?=&]*$/.test(valor) ? valor : null;
}
