import { PRESET_ENCUENTRO_2026 } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { calcularResultados, type PlanillaParaResultado, type PuertosResultados, type ResultadoCalculado } from './resultados';

const fichas = [
  { id: 'f1', academiaId: 'a1', categoria: 'JUVENIL', formacion: 'SOLO', genero: 'JAZZ' },
  { id: 'f2', academiaId: 'a2', categoria: 'JUVENIL', formacion: 'SOLO', genero: 'JAZZ' },
  { id: 'f3', academiaId: 'a3', categoria: 'JUVENIL', formacion: 'SOLO', genero: 'JAZZ' },
];
const pl = (
  fichaId: string,
  juradoId: string,
  total: number | null,
  estado: PlanillaParaResultado['estado'] = 'ENVIADA',
): PlanillaParaResultado => ({ fichaId, juradoId, total, estado });

function fake(planillas: PlanillaParaResultado[], supervisa = true) {
  const guardados: ResultadoCalculado[][] = [];
  const p: PuertosResultados = {
    puedeSupervisar: () => supervisa,
    reglamento: async (id) => (id === 'e1' ? PRESET_ENCUENTRO_2026 : null),
    fichasPresentadas: async () => fichas,
    planillas: async () => planillas,
    guardarResultados: async (_e, r) => void guardados.push(r),
  };
  return { p, guardados };
}

describe('[OR-41] [TR-08] [OP-02] cálculo de resultados', () => {
  it('calcula puntaje, banda y puesto con las planillas enviadas; detecta desvíos', async () => {
    const { p, guardados } = fake([
      pl('f1', 'j1', 9.2),
      pl('f1', 'j2', 9.1),
      pl('f1', 'j3', 9.0),
      pl('f2', 'j1', 8.0),
      pl('f2', 'j2', 8.4),
      pl('f2', 'j3', 5.0),
      pl('f3', 'j1', 7.0),
      pl('f3', 'j2', 7.2),
      pl('f3', 'j3', null, 'BORRADOR'),
    ]);
    const r = await calcularResultados(p, 'e1', { juradosEsperados: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.resultados.map((x) => [x.fichaId, x.puntaje, x.banda, x.puesto])).toEqual([
      ['f1', 9.1, 'ORO', 1],
      ['f2', 7.13, 'BRONCE', 2],
    ]);
    expect(r.value.pendientes).toEqual(['f3']);
    expect(r.value.desvios.map((d) => d.fichaId)).toEqual(['f2']);
    expect(guardados).toHaveLength(1);
  });
  it('valida permiso, evento y existencia de planillas', async () => {
    expect(await calcularResultados(fake([], false).p, 'e1', { juradosEsperados: 3 })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
    expect(await calcularResultados(fake([]).p, 'x', { juradosEsperados: 3 })).toMatchObject({
      ok: false,
      error: { codigo: 'EVENTO_INEXISTENTE' },
    });
    expect(await calcularResultados(fake([]).p, 'e1', { juradosEsperados: 3 })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PLANILLAS' },
    });
  });
});
