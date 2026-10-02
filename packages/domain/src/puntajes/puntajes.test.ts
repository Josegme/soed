import { describe, expect, it } from 'vitest';
import { PRESET_ENCUENTRO_2026 } from '../reglamento/presets/encuentro-2026';
import { banda, claveGrupo, detectarDesvios, puntajeFinal, ranking, redondear, totalPlanilla, validarNota, type ResultadoFicha } from './puntajes';

const config = PRESET_ENCUENTRO_2026.puntaje;
const criterios = [
  { codigo: 'TECNICA', peso: 2 },
  { codigo: 'INTERPRETACION', peso: 1 },
  { codigo: 'COREOGRAFIA', peso: 1 },
];

describe('[JU-03] notas y total de planilla', () => {
  it('valida escala y decimales', () => {
    expect(validarNota(9.5, config)).toEqual({ ok: true, value: 9.5 });
    expect(validarNota(10.1, config)).toMatchObject({ ok: false, error: { codigo: 'NOTA_FUERA_DE_ESCALA' } });
    expect(validarNota(-1, config)).toMatchObject({ ok: false });
    expect(validarNota(9.55, config)).toMatchObject({ ok: false, error: { codigo: 'DECIMALES_EXCEDIDOS' } });
    expect(validarNota(1e-7, { ...config, decimalesNota: 2 })).toMatchObject({ ok: false, error: { codigo: 'DECIMALES_EXCEDIDOS' } });
  });
  it('calcula el promedio ponderado por criterio', () => {
    const r = totalPlanilla(
      [
        { criterio: 'TECNICA', valor: 9 },
        { criterio: 'INTERPRETACION', valor: 8 },
        { criterio: 'COREOGRAFIA', valor: 10 },
      ],
      criterios,
      config,
    );
    expect(r).toEqual({ ok: true, value: 9 });
  });
  it('exige todos los criterios, rechaza desconocidos y notas inválidas', () => {
    expect(totalPlanilla([{ criterio: 'TECNICA', valor: 9 }], criterios, config)).toMatchObject({ ok: false, error: { codigo: 'CRITERIO_FALTANTE' } });
    expect(totalPlanilla([{ criterio: 'X', valor: 9 }], criterios, config)).toMatchObject({ ok: false, error: { codigo: 'CRITERIO_DESCONOCIDO' } });
    expect(totalPlanilla([{ criterio: 'TECNICA', valor: 11 }, { criterio: 'INTERPRETACION', valor: 1 }, { criterio: 'COREOGRAFIA', valor: 1 }], criterios, config)).toMatchObject({ ok: false });
    expect(totalPlanilla([], [{ codigo: 'X', peso: 0 }].slice(1), config)).toEqual({ ok: true, value: 0 });
  });
});

describe('puntaje final y redondeo', () => {
  it('promedia los totales de los jurados con los decimales del resultado', () => {
    expect(puntajeFinal([9, 8.5, 8.8], config)).toBe(8.77);
    expect(puntajeFinal([], config)).toBeNull();
  });
  it('descarta extremos con tres o más jurados si se configura', () => {
    const c = { ...config, agregacion: 'PROMEDIO_SIN_EXTREMOS' as const };
    expect(puntajeFinal([5, 9, 9.2, 10], c)).toBe(9.1);
    expect(puntajeFinal([5, 9], c)).toBe(7);
  });
  it('redondea mitad hacia arriba sin error binario', () => {
    expect(redondear(8.995, 2)).toBe(9);
    expect(redondear(8.994, 2)).toBe(8.99);
    expect(redondear(1.005, 2)).toBe(1.01);
    expect(redondear((9 + 8.99) / 2, 2)).toBe(9);
    expect(redondear(-2.345, 2)).toBe(-2.35);
    expect(redondear(-0.001, 2)).toBe(0);
    expect(redondear(1e-7, 2)).toBe(0);
    expect(redondear(Number.NaN, 2)).toBeNaN();
  });
  it('[TR-08] un promedio de 8,995 alcanza la banda Oro', () => {
    expect(puntajeFinal([9, 8.99], config)).toBe(9);
  });
});

describe('[TR-08] bandas 9,0 / 8,0 / 7,0', () => {
  const bandas = PRESET_ENCUENTRO_2026.bandas;
  it('asigna la banda por umbral inclusivo', () => {
    expect(banda(9, bandas)?.codigo).toBe('ORO');
    expect(banda(8.99, bandas)?.codigo).toBe('PLATA');
    expect(banda(8, bandas)?.codigo).toBe('PLATA');
    expect(banda(7, bandas)?.codigo).toBe('BRONCE');
    expect(banda(6.99, bandas)).toBeNull();
  });
});

describe('[OP-02] control de desvíos', () => {
  it('marca al jurado que se aparta del resto más que el umbral', () => {
    const d = detectarDesvios(
      [
        { juradoId: 'j1', total: 9 },
        { juradoId: 'j2', total: 8.8 },
        { juradoId: 'j3', total: 6.5 },
      ],
      1.5,
    );
    expect(d.map((x) => x.juradoId)).toEqual(['j3']);
    expect(d[0]?.diferencia).toBe(-2.4);
  });
  it('no evalúa con menos de dos jurados', () => {
    expect(detectarDesvios([{ juradoId: 'j1', total: 1 }], 0.5)).toEqual([]);
  });
});

describe('[OR-41] [OR-35] ranking por grupo', () => {
  const r = (fichaId: string, puntaje: number, extra: Partial<ResultadoFicha> = {}): ResultadoFicha => ({
    fichaId,
    categoria: 'JUVENIL',
    formacion: 'SOLO',
    genero: 'JAZZ',
    puntaje,
    ...extra,
  });
  it('ordena por puntaje, comparte puesto en empate (1, 1, 3) y agrupa', () => {
    const p = ranking([r('a', 9.1), r('b', 9.5), r('c', 9.1), r('d', 8, { genero: 'BALLET' })], ['categoria', 'formacion', 'genero']);
    expect(p).toEqual([
      { fichaId: 'b', grupo: 'JUVENIL|SOLO|JAZZ', puesto: 1 },
      { fichaId: 'a', grupo: 'JUVENIL|SOLO|JAZZ', puesto: 2 },
      { fichaId: 'c', grupo: 'JUVENIL|SOLO|JAZZ', puesto: 2 },
      { fichaId: 'd', grupo: 'JUVENIL|SOLO|BALLET', puesto: 1 },
    ]);
  });
  it('desempata con criterios prioritarios si se proveen', () => {
    const p = ranking([r('a', 9, { desempate: [8.5] }), r('b', 9, { desempate: [9.2] }), r('c', 9)], []);
    expect(p.map((x) => `${x.fichaId}:${x.puesto}`)).toEqual(['b:1', 'a:2', 'c:3']);
    expect(claveGrupo(r('a', 1), [])).toBe('GENERAL');
  });
});
