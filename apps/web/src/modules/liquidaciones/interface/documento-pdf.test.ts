import { writeFileSync } from 'node:fs';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { DocumentoLiquidacion, type TextosLiquidacionPdf } from './documento-pdf';

const textos: TextosLiquidacionPdf = {
  titulo: 'Liquidación',
  marca: 'Encuentro de Danzas',
  numero: 'LIQ-FLN27-0007',
  version: 'LIQ-FLN27-0007 · versión 2',
  emitida: 'Emitida el 2 oct 2026, 10:15',
  evento: 'Selectivo Florianópolis 2027',
  academia: 'Academia São João — Ñandú',
  encabezados: { concepto: 'Concepto', cantidad: 'Cant.', unitario: 'Unitario', importe: 'Importe' },
  filas: [
    { concepto: 'Inscripción por bailarín', cantidad: '12', unitario: 'R$ 100,00', importe: 'R$ 1.200,00' },
    { concepto: 'Coreografía', detalle: 'Grupo «Raíces»', cantidad: '1', unitario: 'R$ 180,00', importe: 'R$ 180,00' },
    { concepto: 'Ajuste', detalle: 'Pase a la final: 20 %', cantidad: '1', unitario: '-R$ 276,00', importe: '-R$ 276,00' },
  ],
  totales: [
    { etiqueta: 'Subtotal', valor: 'R$ 1.380,00' },
    { etiqueta: 'Total', valor: 'R$ 1.104,00', destacado: true },
    { etiqueta: 'Cobrado', valor: 'R$ 500,00' },
    { etiqueta: 'Saldo', valor: 'R$ 604,00', destacado: true },
  ],
  datosPagoTitulo: 'Datos para pagar',
  datosPago: 'PIX: inscripciones@encuentrodanzas.com',
  leyenda: 'Este documento no es una factura ni un comprobante fiscal.',
  pie: 'Encuentro de Danzas · generado con SOED',
};

describe('[PR-16] PDF de liquidación', () => {
  it('renderiza un PDF válido con acentos y símbolos de moneda', async () => {
    const buffer = await renderToBuffer(
      createElement(DocumentoLiquidacion, { textos, color: '#0b3a46' }) as Parameters<typeof renderToBuffer>[0],
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    if (process.env.PDF_MUESTRA) writeFileSync(process.env.PDF_MUESTRA, buffer);
  });
});
