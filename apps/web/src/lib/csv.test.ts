import { describe, expect, it } from 'vitest';
import { celdaCsv, generarCsv } from './csv';

describe('[OR-49] exportación CSV', () => {
  it('escapa separador, comillas y saltos de línea', () => {
    expect(celdaCsv('Academia; Uno')).toBe('"Academia; Uno"');
    expect(celdaCsv('Dijo "hola"')).toBe('"Dijo ""hola"""');
    expect(celdaCsv('línea 1\nlínea 2')).toBe('"línea 1\nlínea 2"');
    expect(celdaCsv(null)).toBe('');
    expect(celdaCsv(-15.5)).toBe('-15.5');
  });
  it('neutraliza fórmulas en textos (inyección CSV)', () => {
    expect(celdaCsv('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(celdaCsv('+5511999')).toBe("'+5511999");
    expect(celdaCsv('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('genera BOM, encabezados y CRLF', () => {
    expect(generarCsv(['a', 'b'], [[1, 'x']])).toBe('﻿a;b\r\n1;x\r\n');
  });
});
