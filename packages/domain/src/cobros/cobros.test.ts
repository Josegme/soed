import { describe, expect, it } from 'vitest';
import { cierreCaja, MEDIOS_COBRO_DEFECTO, montoSugerido, validarAnulacion, validarCobro, type CobroNuevo } from './cobros';

const uuid = '3f2a9c1e-5b7d-4e8f-9a0b-1c2d3e4f5a6b';
const contexto = { monedaEvento: 'BRL' as const, mediosHabilitados: [...MEDIOS_COBRO_DEFECTO] };
const cobro = (over: Partial<CobroNuevo> = {}): CobroNuevo => ({ montoCentavos: 5000, moneda: 'BRL', medio: 'PIX', clientUuid: uuid, ...over });

describe('[OR-28] [OR-29] [OP-20] registro de cobros', () => {
  it('acepta un cobro parcial válido', () => {
    expect(validarCobro(cobro(), contexto)).toEqual({ ok: true, value: cobro() });
  });
  it('rechaza montos no positivos o no enteros', () => {
    expect(validarCobro(cobro({ montoCentavos: 0 }), contexto)).toMatchObject({ ok: false, error: { codigo: 'MONTO_INVALIDO' } });
    expect(validarCobro(cobro({ montoCentavos: 10.5 }), contexto)).toMatchObject({ ok: false });
  });
  it('rechaza moneda distinta de la del evento y medios no habilitados', () => {
    expect(validarCobro(cobro({ moneda: 'USD' }), contexto)).toMatchObject({ ok: false, error: { codigo: 'MONEDA_DISTINTA' } });
    expect(validarCobro(cobro({ medio: 'CHEQUE' }), contexto)).toMatchObject({ ok: false, error: { codigo: 'MEDIO_NO_HABILITADO' } });
  });
  it('[TR-47] exige un client_uuid válido para la idempotencia offline', () => {
    expect(validarCobro(cobro({ clientUuid: 'x' }), contexto)).toMatchObject({ ok: false, error: { codigo: 'CLIENT_UUID_INVALIDO' } });
  });
  it('propone el saldo como monto y nunca un negativo', () => {
    expect(montoSugerido(4200)).toBe(4200);
    expect(montoSugerido(-100)).toBe(0);
  });
});

describe('[OR-30] anulación de cobros', () => {
  it('exige motivo y no permite anular dos veces', () => {
    expect(validarAnulacion('  error de monto ', false)).toEqual({ ok: true, value: { motivo: 'error de monto' } });
    expect(validarAnulacion('x', false)).toMatchObject({ ok: false, error: { codigo: 'MOTIVO_REQUERIDO' } });
    expect(validarAnulacion('duplicado', true)).toMatchObject({ ok: false, error: { codigo: 'COBRO_YA_ANULADO' } });
  });
});

describe('[OR-31] [OP-21] cierre de caja', () => {
  it('totaliza por medio y por persona, excluyendo anulados', () => {
    const r = cierreCaja([
      { montoCentavos: 1000, medio: 'EFECTIVO', registradoPor: 'ana', anulado: false },
      { montoCentavos: 2500, medio: 'PIX', registradoPor: 'ana', anulado: false },
      { montoCentavos: 700, medio: 'EFECTIVO', registradoPor: 'luis', anulado: false },
      { montoCentavos: 9999, medio: 'EFECTIVO', registradoPor: 'luis', anulado: true },
    ]);
    expect(r).toEqual({
      totalCentavos: 4200,
      cantidad: 3,
      porMedio: { EFECTIVO: 1700, PIX: 2500 },
      porPersona: { ana: 3500, luis: 700 },
      anulados: { cantidad: 1, totalCentavos: 9999 },
    });
  });
});
