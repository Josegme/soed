import type { ConfigPuntaje } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { guardarPlanilla, type PlanillaPropia, type PuertosPlanilla } from './planillas';

const PUNTAJE: ConfigPuntaje = {
  escalaMin: 0,
  escalaMax: 10,
  decimalesNota: 1,
  decimalesResultado: 2,
  agregacion: 'PROMEDIO',
  umbralDesvio: 1.5,
  agrupacionRanking: ['categoria'],
};

function fakes(opciones: { permiso?: boolean; propia?: PlanillaPropia | null; porUuid?: PlanillaPropia | null } = {}) {
  const llamadas: string[] = [];
  const p: PuertosPlanilla = {
    puedeCargar: () => opciones.permiso ?? true,
    ficha: async (id) => (id === 'f1' ? { id: 'f1', eventoId: 'e1', academiaId: 'a1' } : null),
    configuracion: async () => ({
      criterios: [
        { id: 'c1', codigo: 'TECNICA', peso: 2 },
        { id: 'c2', codigo: 'ARTE', peso: 1 },
      ],
      puntaje: PUNTAJE,
    }),
    planillaPorClientUuid: async () => opciones.porUuid ?? null,
    planillaPropia: async () => opciones.propia ?? null,
    crear: async () => {
      llamadas.push('crear');
      return 'p1';
    },
    guardarNotas: async (_id, _ev, notas) => void llamadas.push(`notas:${notas.length}`),
    actualizar: async (_id, c) => void llamadas.push(`actualizar:${c.enviar ? 'enviar' : 'borrador'}`),
  };
  return { p, llamadas };
}

const base = { fichaId: 'f1', clientUuid: 'u1', comentario: '  Muy buena  ' };

describe('[JU-03] [JU-04] [JU-05] [JU-06] planilla del jurado', () => {
  it('guarda un borrador incompleto sin enviarlo', async () => {
    const { p, llamadas } = fakes();
    const r = await guardarPlanilla(p, { ...base, notas: [{ criterioId: 'c1', valor: 9 }], enviar: false });
    expect(r).toEqual({ ok: true, value: { planillaId: 'p1', enviada: false, total: null, duplicado: false } });
    expect(llamadas).toEqual(['crear', 'notas:1', 'actualizar:borrador']);
  });

  it('envía con todas las notas y calcula el total ponderado', async () => {
    const { p, llamadas } = fakes();
    const r = await guardarPlanilla(p, {
      ...base,
      notas: [
        { criterioId: 'c1', valor: 9 },
        { criterioId: 'c2', valor: 6 },
      ],
      enviar: true,
    });
    expect(r.ok && r.value.total).toBe(8);
    expect(llamadas).toContain('actualizar:enviar');
  });

  it('no envía con criterios faltantes ni notas fuera de escala', async () => {
    const { p } = fakes();
    expect(await guardarPlanilla(p, { ...base, notas: [{ criterioId: 'c1', valor: 9 }], enviar: true })).toMatchObject({
      ok: false,
      error: { codigo: 'CRITERIO_FALTANTE' },
    });
    expect(await guardarPlanilla(p, { ...base, notas: [{ criterioId: 'c1', valor: 11 }], enviar: false })).toMatchObject({
      ok: false,
      error: { codigo: 'NOTA_FUERA_DE_ESCALA' },
    });
    expect(await guardarPlanilla(p, { ...base, notas: [{ criterioId: 'c1', valor: 8.55 }], enviar: false })).toMatchObject({
      ok: false,
      error: { codigo: 'DECIMALES_EXCEDIDOS' },
    });
  });

  it('una planilla enviada no se modifica (salvo reapertura del director técnico)', async () => {
    const { p } = fakes({ propia: { id: 'p1', estado: 'ENVIADA' } });
    expect(await guardarPlanilla(p, { ...base, notas: [], enviar: false })).toMatchObject({
      ok: false,
      error: { codigo: 'PLANILLA_ENVIADA' },
    });
  });

  it('[ADR-0010] un reintento con el mismo client_uuid es idempotente', async () => {
    const { p, llamadas } = fakes({ porUuid: { id: 'p1', estado: 'ENVIADA' } });
    expect(await guardarPlanilla(p, { ...base, notas: [], enviar: true })).toEqual({
      ok: true,
      value: { planillaId: 'p1', enviada: true, total: null, duplicado: true },
    });
    expect(llamadas).toEqual([]);
  });

  it('sin permiso de jurado no carga', async () => {
    const { p } = fakes({ permiso: false });
    expect(await guardarPlanilla(p, { ...base, notas: [], enviar: false })).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });
});
