import { describe, expect, it } from 'vitest';
import { registrarPase, type PuertosPase } from './pases';

function fake(opc: { permiso?: boolean; destino?: boolean; propia?: boolean } = {}) {
  const insertados: unknown[] = [];
  const p: PuertosPase = {
    puedeRegistrar: () => opc.permiso ?? true,
    destinoValido: async () => opc.destino ?? true,
    coreografiaDeAcademia: async () => opc.propia ?? true,
    insertar: async (d) => {
      insertados.push(d);
      return 'p1';
    },
  };
  return { p, insertados };
}
const base = { eventoOrigenId: 'e1', eventoDestinoId: 'f1', academiaId: 'a1', motivo: 'Segundo puesto, el primero desistió' };

describe('[OR-33] [TR-13] registrar pase manual', () => {
  it('registra un pase de coreografía con beneficio', async () => {
    const { p, insertados } = fake();
    expect(await registrarPase(p, { ...base, coreografiaId: 'c1', beneficio: { tipo: 'BECA' } })).toEqual({
      ok: true,
      value: { paseId: 'p1' },
    });
    expect(insertados[0]).toMatchObject({ coreografiaId: 'c1', academiaId: 'a1', beneficio: { tipo: 'BECA' } });
  });
  it('registra un pase de academia completa', async () => {
    const { p, insertados } = fake();
    await registrarPase(p, base);
    expect(insertados[0]).toMatchObject({ coreografiaId: null });
  });
  it('valida permiso, destino, motivo y pertenencia', async () => {
    expect(await registrarPase(fake({ permiso: false }).p, base)).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
    expect(await registrarPase(fake({ destino: false }).p, base)).toMatchObject({ ok: false, error: { codigo: 'DESTINO_INVALIDO' } });
    expect(await registrarPase(fake().p, { ...base, motivo: 'no' })).toMatchObject({ ok: false, error: { codigo: 'MOTIVO_REQUERIDO' } });
    expect(await registrarPase(fake({ propia: false }).p, { ...base, coreografiaId: 'c9' })).toMatchObject({
      ok: false,
      error: { codigo: 'COREOGRAFIA_AJENA' },
    });
  });
});
