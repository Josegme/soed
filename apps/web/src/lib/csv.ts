/**
 * CSV para Excel en es/pt-BR: separador `;`, BOM UTF-8 y CRLF. Neutraliza la
 * inyección de fórmulas (=, +, -, @, tab, CR) anteponiendo un apóstrofo.
 */
export type ValorCsv = string | number | null | undefined;

const PELIGROSO = /^[=+\-@\t\r]/;

export function celdaCsv(valor: ValorCsv): string {
  if (valor === null || valor === undefined) return '';
  let texto = typeof valor === 'number' ? String(valor) : valor;
  if (typeof valor === 'string' && PELIGROSO.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function generarCsv(encabezados: readonly string[], filas: readonly (readonly ValorCsv[])[]): string {
  const lineas = [encabezados, ...filas].map((f) => f.map(celdaCsv).join(';'));
  return `﻿${lineas.join('\r\n')}\r\n`;
}
