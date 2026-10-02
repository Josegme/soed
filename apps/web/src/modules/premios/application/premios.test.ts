import { describe, expect, it } from 'vitest';
import { asignarPremio, type PremioLeido, type PuertosPremio } from './premios';

function fakes(premio: Partial<PremioLeido> = {}, permiso = true) {
  const guardado: unknown[] = [];
  const p: PuertosPremio = {
    premio: async (id) =>
      id === 'p1'
        ? {
            id: 'p1',
            eventoId: 'e1',
            montoCentavos: 100001,
            moneda: 'BRL',
            criterio: 'MANUAL',
            reglaEmpate: 'DIVIDIR_MONTO',
            filtro: {},
            ...premio,
          }
        : null,
    puedeAsignar: () => permiso,
    ranking: async () => [
      { fichaId: 'f1', grupo: 'JUV|SOLO|JAZZ', puesto: 1 },
      { fichaId: 'f2', grupo: 'JUV|SOLO|JAZZ', puesto: 1 },
      { fichaId: 'f3', grupo: 'JUV|SOLO|JAZZ', puesto: 3 },
      { fichaId: 'f4', grupo: 'INF|SOLO|JAZZ', puesto: 1 },
    ],
    fichas: async (_e, ids) => ids.filter((i) => i !== 'ajena').map((id) => ({ id, academiaId: `a-${id}` })),
    reemplazarAsignaciones: async (_p, _e, a) => void guardado.push(...a),
  };
  return { p, guardado };
}

describe('[OR-10] [OR-43] asignación de premios', () => {
  it('por ranking: el empate en el primer puesto divide el monto sin perder centavos', async () => {
    const { p, guardado } = fakes({ criterio: 'RANKING', filtro: { puesto: 1, grupo: 'JUV|SOLO|JAZZ' } });
    expect(await asignarPremio(p, { premioId: 'p1' })).toEqual({ ok: true, value: { asignadas: 2 } });
    expect(guardado).toEqual([
      { fichaId: 'f1', academiaId: 'a-f1', montoCentavos: 50001 },
      { fichaId: 'f2', academiaId: 'a-f2', montoCentavos: 50000 },
    ]);
  });
  it('manual con monto completo para cada uno y premios sin monto', async () => {
    const completo = fakes({ reglaEmpate: 'MONTO_COMPLETO_CADA_UNO' });
    await asignarPremio(completo.p, { premioId: 'p1', fichaIds: ['f1', 'f3'] });
    expect(completo.guardado).toEqual([
      { fichaId: 'f1', academiaId: 'a-f1', montoCentavos: 100001 },
      { fichaId: 'f3', academiaId: 'a-f3', montoCentavos: 100001 },
    ]);
    const sinMonto = fakes({ montoCentavos: null, moneda: null });
    await asignarPremio(sinMonto.p, { premioId: 'p1', fichaIds: ['f4'] });
    expect(sinMonto.guardado).toEqual([{ fichaId: 'f4', academiaId: 'a-f4', montoCentavos: null }]);
  });
  it('valida permiso, ganadoras y fichas del evento', async () => {
    expect(await asignarPremio(fakes({}, false).p, { premioId: 'p1', fichaIds: ['f1'] })).toMatchObject({
      error: { codigo: 'SIN_PERMISO' },
    });
    expect(await asignarPremio(fakes().p, { premioId: 'p1', fichaIds: [] })).toMatchObject({ error: { codigo: 'SIN_GANADORES' } });
    expect(await asignarPremio(fakes().p, { premioId: 'p1', fichaIds: ['ajena'] })).toMatchObject({ error: { codigo: 'FICHA_AJENA' } });
    expect(await asignarPremio(fakes().p, { premioId: 'x' })).toMatchObject({ error: { codigo: 'PREMIO_INEXISTENTE' } });
    expect(await asignarPremio(fakes({ eventoId: null }).p, { premioId: 'p1', fichaIds: ['f1'] })).toMatchObject({
      error: { codigo: 'PREMIO_DE_TEMPORADA' },
    });
  });
});
