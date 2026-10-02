import type { CampoAdicional } from '@soed/domain';

/**
 * Lee del formulario los valores de los campos adicionales (`dato.<codigo>`)
 * con el tipo de cada definición; lo vacío queda fuera para que el dominio
 * decida si era obligatorio (OR-16, PR-18).
 */
export function valoresCamposAdicionales(
  definiciones: readonly CampoAdicional[],
  datos: FormData,
): Record<string, string | number | boolean> {
  const valores: Record<string, string | number | boolean> = {};
  for (const c of definiciones) {
    const crudo = datos.get(`dato.${c.codigo}`);
    if (c.tipo === 'BOOLEANO') {
      valores[c.codigo] = crudo === 'on';
      continue;
    }
    const texto = typeof crudo === 'string' ? crudo.trim() : '';
    if (!texto) continue;
    if (c.tipo === 'NUMERO') {
      const n = Number(texto.replace(',', '.'));
      valores[c.codigo] = Number.isFinite(n) ? n : texto;
    } else {
      valores[c.codigo] = texto.slice(0, 500);
    }
  }
  return valores;
}
