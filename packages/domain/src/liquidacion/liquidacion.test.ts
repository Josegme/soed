import { describe, expect, it } from 'vitest';
import { calcularLiquidacion, esSlugNumeracionValido, estadoLiquidacion, formatearNumeroLiquidacion, saldoLiquidacion } from './calcular';
import type { FichaALiquidar, InscripcionALiquidar, Tarifario } from './tipos';

const ficha = (id: string, bailarines: string[], over: Partial<FichaALiquidar> = {}): FichaALiquidar => ({
  id,
  formacion: bailarines.length === 1 ? 'SOLO' : bailarines.length < 4 ? 'DUO' : 'GRUPO',
  genero: 'JAZZ',
  categoria: 'JUVENIL',
  estado: 'ENVIADA',
  integrantes: bailarines.map((bailarinId) => ({ bailarinId })),
  ...over,
});

const inscripcion = (fichas: FichaALiquidar[], over: Partial<InscripcionALiquidar> = {}): InscripcionALiquidar => ({
  fichas,
  rubros: [],
  ajustes: [],
  ...over,
});

const total = (t: Tarifario, i: InscripcionALiquidar, incluirBorradores = false): number => {
  const r = calcularLiquidacion(t, i, { incluirBorradores });
  if (!r.ok) throw new Error(r.error.codigo);
  return r.value.total;
};

describe('[OR-06] [TR-18] cálculo de la liquidación', () => {
  it('cobra por bailarín distinto', () => {
    const t: Tarifario = { moneda: 'BRL', porBailarin: { precio: 10000 } };
    expect(total(t, inscripcion([ficha('f1', ['a']), ficha('f2', ['a', 'b', 'c', 'd'])]))).toBe(40000);
  });
  it('cobra por coreografía con precio distinto por formación', () => {
    const t: Tarifario = { moneda: 'ARS', porCoreografia: { precioBase: 5000, porFormacion: { SOLO: 8000 } } };
    expect(total(t, inscripcion([ficha('f1', ['a']), ficha('f2', ['a', 'b', 'c', 'd'])]))).toBe(13000);
  });
  it('cobra la coreografía extra por participante desde la segunda (Art. 12)', () => {
    const t: Tarifario = { moneda: 'BRL', porBailarin: { precio: 10000 }, porParticipacion: { precio: 3000, desdeNumero: 2 } };
    const i = inscripcion([ficha('f1', ['a', 'b', 'c', 'd']), ficha('f2', ['a', 'b']), ficha('f3', ['a'])]);
    const r = calcularLiquidacion(t, i);
    expect(r.ok && r.value.lineas.filter((l) => l.concepto === 'POR_PARTICIPACION')).toEqual([
      { concepto: 'POR_PARTICIPACION', referencia: 'f2', cantidad: 2, precioUnitario: 3000, importe: 6000 },
      { concepto: 'POR_PARTICIPACION', referencia: 'f3', cantidad: 1, precioUnitario: 3000, importe: 3000 },
    ]);
    expect(total(t, i)).toBe(40000 + 9000);
  });
  it('[TR-09] el Quadro cuesta como dos coreografías', () => {
    const t: Tarifario = {
      moneda: 'BRL',
      porCoreografia: { precioBase: 20000 },
      porParticipacion: { precio: 1000, desdeNumero: 1 },
      recargos: [
        { codigo: 'QUADRO_X2', nombre: { es: 'Quadro' }, tipo: 'MULTIPLICADOR_COREOGRAFIA', filtro: { formacion: 'QUADRO' }, factor: 2 },
      ],
    };
    const i = inscripcion([ficha('q', ['a', 'b', 'c', 'd'], { formacion: 'QUADRO' }), ficha('g', ['e', 'f', 'g', 'h'])]);
    expect(total(t, i)).toBe(20000 * 2 + 20000 + 4 * 1000 * 2 + 4 * 1000);
  });
  it('aplica monto fijo por academia, rubros opcionales y recargos por monto', () => {
    const t: Tarifario = {
      moneda: 'USD',
      fijoAcademia: { precio: 5000 },
      rubros: [{ codigo: 'VESTUARIO', nombre: { es: 'Vestuario' }, precioUnitario: 1500 }],
      recargos: [
        { codigo: 'ADULTO_EXTRA', nombre: { es: 'Recargo' }, tipo: 'MONTO_POR_COREOGRAFIA', filtro: { categoria: 'ADULTO' }, monto: 700 },
        { codigo: 'COREOGRAFO', nombre: { es: 'Corégrafo que baila' }, tipo: 'MONTO_POR_BAILARIN', condicion: 'ES_COREOGRAFO', monto: 900 },
      ],
    };
    const i = inscripcion(
      [
        ficha('f1', ['a'], { categoria: 'ADULTO', integrantes: [{ bailarinId: 'a', esCoreografo: true }] }),
        ficha('f2', ['a', 'b'], { integrantes: [{ bailarinId: 'a', esCoreografo: true }, { bailarinId: 'b' }] }),
      ],
      { rubros: [{ codigo: 'VESTUARIO', cantidad: 2 }] },
    );
    expect(total(t, i)).toBe(5000 + 3000 + 700 + 900);
  });
  it('no cobra fichas retiradas ni borradores, salvo en la vista previa', () => {
    const t: Tarifario = { moneda: 'BRL', porCoreografia: { precioBase: 1000 } };
    const i = inscripcion([ficha('f1', ['a']), ficha('f2', ['b'], { estado: 'RETIRADA' }), ficha('f3', ['c'], { estado: 'BORRADOR' })]);
    expect(total(t, i)).toBe(1000);
    expect(total(t, i, true)).toBe(2000);
  });
  it('[OR-25] aplica sin cargo, monto libre y descuentos sin quedar negativo', () => {
    const t: Tarifario = { moneda: 'BRL', porCoreografia: { precioBase: 10000 } };
    const base = [ficha('f1', ['a'])];
    expect(total(t, inscripcion(base, { ajustes: [{ tipo: 'SIN_CARGO', motivo: 'Beca' }] }))).toBe(0);
    expect(total(t, inscripcion(base, { ajustes: [{ tipo: 'MONTO_LIBRE', monto: 2500, motivo: 'Acuerdo' }] }))).toBe(2500);
    expect(total(t, inscripcion(base, { ajustes: [{ tipo: 'DESCUENTO_PORCENTAJE', porcentaje: 15, motivo: 'Pase' }] }))).toBe(8500);
    expect(total(t, inscripcion(base, { ajustes: [{ tipo: 'DESCUENTO_MONTO', monto: 99999, motivo: 'Pase' }] }))).toBe(0);
  });
  it('rechaza rubros desconocidos, cantidades y ajustes inválidos', () => {
    const t: Tarifario = { moneda: 'BRL', rubros: [{ codigo: 'R', nombre: {}, precioUnitario: 1 }] };
    expect(calcularLiquidacion(t, inscripcion([], { rubros: [{ codigo: 'X', cantidad: 1 }] }))).toMatchObject({
      ok: false,
      error: { codigo: 'RUBRO_DESCONOCIDO' },
    });
    expect(calcularLiquidacion(t, inscripcion([], { rubros: [{ codigo: 'R', cantidad: -1 }] }))).toMatchObject({
      ok: false,
      error: { codigo: 'CANTIDAD_INVALIDA' },
    });
    expect(calcularLiquidacion(t, inscripcion([], { ajustes: [{ tipo: 'SIN_CARGO', motivo: ' ' }] }))).toMatchObject({
      ok: false,
      error: { codigo: 'AJUSTE_INVALIDO' },
    });
    expect(
      calcularLiquidacion(t, inscripcion([], { ajustes: [{ tipo: 'DESCUENTO_PORCENTAJE', porcentaje: 0, motivo: 'x' }] })),
    ).toMatchObject({ ok: false });
    expect(calcularLiquidacion(t, inscripcion([], { ajustes: [{ tipo: 'MONTO_LIBRE', monto: -5, motivo: 'x' }] }))).toMatchObject({
      ok: false,
    });
  });
  it('un rubro en cero no genera línea', () => {
    const t: Tarifario = { moneda: 'BRL', rubros: [{ codigo: 'R', nombre: {}, precioUnitario: 100 }] };
    const r = calcularLiquidacion(t, inscripcion([], { rubros: [{ codigo: 'R', cantidad: 0 }] }));
    expect(r.ok && r.value.lineas).toEqual([]);
  });
});

describe('[TR-19] estados derivados y saldo', () => {
  it('deriva los cuatro estados', () => {
    expect(estadoLiquidacion(0, 0)).toBe('SIN_CARGO');
    expect(estadoLiquidacion(1000, 0)).toBe('PENDIENTE');
    expect(estadoLiquidacion(1000, 400)).toBe('PARCIAL');
    expect(estadoLiquidacion(1000, 1000)).toBe('PAGADA');
    expect(estadoLiquidacion(1000, 1500)).toBe('PAGADA');
  });
  it('si la academia agrega coreografías después de pagar, el saldo es la diferencia', () => {
    expect(saldoLiquidacion(15000, 10000)).toBe(5000);
    expect(saldoLiquidacion(10000, 12000)).toBe(-2000);
  });
});

describe('[TR-15] numeración LIQ-<SLUG>-0001', () => {
  it('formatea con cuatro dígitos y crece si supera 9999', () => {
    expect(formatearNumeroLiquidacion('floripa26', 1)).toBe('LIQ-FLORIPA26-0001');
    expect(formatearNumeroLiquidacion('SEL1', 10000)).toBe('LIQ-SEL1-10000');
  });
  it('rechaza slugs y correlativos inválidos', () => {
    expect(esSlugNumeracionValido('CON-GUION')).toBe(false);
    expect(() => formatearNumeroLiquidacion('a', 1)).toThrow();
    expect(() => formatearNumeroLiquidacion('OK', 0)).toThrow();
  });
});
