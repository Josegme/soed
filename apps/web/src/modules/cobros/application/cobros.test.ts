import { describe, expect, it } from 'vitest';
import { anularCobro, registrarCobro, resumenCaja, type LiquidacionParaCobro, type PuertosCobro } from './cobros';

const liq: LiquidacionParaCobro = {
  id: 'l1',
  eventoId: 'e1',
  academiaId: 'a1',
  numero: 'LIQ-SELA-0001',
  moneda: 'BRL',
  totalCentavos: 10000,
  cobradoCentavos: 2000,
  mediosHabilitados: ['PIX', 'EFECTIVO'],
};
const uuid = '7f6c2b0a-1d2e-4f3a-9b8c-0d1e2f3a4b5c';

function fake(permisos: string[] = ['cobros.registrar', 'cobros.anular'], duplicado = false) {
  const insertados: unknown[] = [];
  const anulados: [string, string][] = [];
  const p: PuertosCobro = {
    leerLiquidacion: async (id) => (id === 'l1' ? liq : null),
    puede: (_e, permiso) => permisos.includes(permiso),
    insertarCobro: async (d) => {
      insertados.push(d);
      return { id: 'c1', duplicado };
    },
    leerCobro: async (id) =>
      id === 'c1' ? { id: 'c1', eventoId: 'e1', anulado: false } : id === 'c2' ? { id: 'c2', eventoId: 'e1', anulado: true } : null,
    anular: async (id, m) => void anulados.push([id, m]),
    turnoAbierto: async () => 't1',
  };
  return { p, insertados, anulados };
}

describe('[OR-28] [OP-20] registrar cobro', () => {
  it('registra en el turno abierto y devuelve el saldo', async () => {
    const { p, insertados } = fake();
    expect(await registrarCobro(p, { liquidacionId: 'l1', montoCentavos: 3000, moneda: 'BRL', medio: 'PIX', clientUuid: uuid })).toEqual({
      ok: true,
      value: { cobroId: 'c1', saldoCentavos: 5000, duplicado: false },
    });
    expect(insertados[0]).toMatchObject({ turnoId: 't1', eventoId: 'e1', academiaId: 'a1' });
  });
  it('[TR-47] un reintento offline idempotente no descuenta dos veces', async () => {
    const { p } = fake(undefined, true);
    expect(
      await registrarCobro(p, { liquidacionId: 'l1', montoCentavos: 3000, moneda: 'BRL', medio: 'PIX', clientUuid: uuid }),
    ).toMatchObject({ ok: true, value: { saldoCentavos: 8000, duplicado: true } });
  });
  it('valida permiso, liquidación, moneda y medio', async () => {
    expect(
      await registrarCobro(fake([]).p, { liquidacionId: 'l1', montoCentavos: 1, moneda: 'BRL', medio: 'PIX', clientUuid: uuid }),
    ).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
    expect(
      await registrarCobro(fake().p, { liquidacionId: 'x', montoCentavos: 1, moneda: 'BRL', medio: 'PIX', clientUuid: uuid }),
    ).toMatchObject({ ok: false, error: { codigo: 'LIQUIDACION_INEXISTENTE' } });
    expect(
      await registrarCobro(fake().p, { liquidacionId: 'l1', montoCentavos: 1, moneda: 'USD', medio: 'PIX', clientUuid: uuid }),
    ).toMatchObject({ ok: false, error: { codigo: 'MONEDA_DISTINTA' } });
    expect(
      await registrarCobro(fake().p, { liquidacionId: 'l1', montoCentavos: 1, moneda: 'BRL', medio: 'CHEQUE', clientUuid: uuid }),
    ).toMatchObject({ ok: false, error: { codigo: 'MEDIO_NO_HABILITADO' } });
  });
});

describe('[OR-30] anular cobro', () => {
  it('anula con motivo y respeta permisos y estado', async () => {
    const { p, anulados } = fake();
    expect(await anularCobro(p, 'c1', ' duplicado ')).toEqual({ ok: true, value: true });
    expect(anulados).toEqual([['c1', 'duplicado']]);
    expect(await anularCobro(p, 'c2', 'otra vez')).toMatchObject({ ok: false, error: { codigo: 'COBRO_YA_ANULADO' } });
    expect(await anularCobro(p, 'zz', 'motivo')).toMatchObject({ ok: false, error: { codigo: 'COBRO_INEXISTENTE' } });
    expect(await anularCobro(fake(['cobros.registrar']).p, 'c1', 'motivo')).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });
  it('[OR-31] resume la caja sin anulados', () => {
    expect(
      resumenCaja([
        { montoCentavos: 100, medio: 'PIX', registradoPor: 'a', anulado: false },
        { montoCentavos: 50, medio: 'PIX', registradoPor: 'a', anulado: true },
      ]).totalCentavos,
    ).toBe(100);
  });
});
