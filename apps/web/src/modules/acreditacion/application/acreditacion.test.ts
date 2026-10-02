import { describe, expect, it } from 'vitest';
import { acreditarPorToken, emitirCredenciales, type CredencialLeida, type PuertosAcreditacion } from './acreditacion';

function fakes(c: Partial<CredencialLeida> | null = {}, opciones: { permiso?: boolean; procesado?: boolean } = {}) {
  const registros: string[] = [];
  const emitidas: number[] = [];
  const p: PuertosAcreditacion = {
    puede: () => opciones.permiso ?? true,
    credencialPorToken: async () =>
      c === null
        ? null
        : {
            id: 'c1',
            eventoId: 'e1',
            tipo: 'BAILARIN',
            nombre: 'Ana',
            academia: 'Uno',
            zonas: [],
            acreditadoAt: null,
            anulada: false,
            ...c,
          },
    registroPorClientUuid: async () => (opciones.procesado ? { credencialId: 'c1' } : null),
    registrar: async (d) => void registros.push(d.clientUuid),
    configuracion: async () => ({}),
    candidatos: async () => [
      { tipo: 'BAILARIN', nombre: 'Ana', bailarinId: 'b1' },
      { tipo: 'BAILARIN', nombre: 'Bruno', bailarinId: 'b2' },
    ],
    existentes: async () => [{ tipo: 'BAILARIN', bailarinId: 'b1', usuarioId: null }],
    emitir: async (_e, nuevas) => void emitidas.push(nuevas.length),
  };
  return { p, registros, emitidas };
}

const ahora = new Date('2026-12-01T12:00:00Z');

describe('[OP-17] [OP-22] [OP-25] [TR-12] acreditación', () => {
  it('acredita y registra con el client_uuid', async () => {
    const { p, registros } = fakes();
    const r = await acreditarPorToken(p, { qrToken: 't', clientUuid: 'u1' }, ahora);
    expect(r).toMatchObject({ ok: true, value: { resultado: 'ACREDITADO', credencial: { nombre: 'Ana' } } });
    expect(registros).toEqual(['u1']);
  });
  it('un segundo escaneo informa la hora del primero sin registrar de nuevo', async () => {
    const { p, registros } = fakes({ acreditadoAt: '2026-12-01T10:00:00Z' });
    expect(await acreditarPorToken(p, { qrToken: 't', clientUuid: 'u2' }, ahora)).toMatchObject({
      ok: true,
      value: { resultado: 'YA_ACREDITADO', at: '2026-12-01T10:00:00Z' },
    });
    expect(registros).toEqual([]);
  });
  it('[ADR-0010] el reintento de la cola offline no duplica', async () => {
    const { p, registros } = fakes({}, { procesado: true });
    expect((await acreditarPorToken(p, { qrToken: 't', clientUuid: 'u1' }, ahora)).ok).toBe(true);
    expect(registros).toEqual([]);
  });
  it('credencial anulada, inexistente o sin permiso', async () => {
    expect(await acreditarPorToken(fakes({ anulada: true }).p, { qrToken: 't', clientUuid: 'u' }, ahora)).toMatchObject({
      error: { codigo: 'CREDENCIAL_ANULADA' },
    });
    expect(await acreditarPorToken(fakes(null).p, { qrToken: 't', clientUuid: 'u' }, ahora)).toMatchObject({
      error: { codigo: 'CREDENCIAL_INEXISTENTE' },
    });
    expect(await acreditarPorToken(fakes({}, { permiso: false }).p, { qrToken: 't', clientUuid: 'u' }, ahora)).toMatchObject({
      error: { codigo: 'SIN_PERMISO' },
    });
  });
  it('[OP-23] emite solo las credenciales que faltan', async () => {
    const { p, emitidas } = fakes();
    expect(await emitirCredenciales(p, 'e1')).toEqual({ ok: true, value: { emitidas: 1 } });
    expect(emitidas).toEqual([1]);
  });
});
