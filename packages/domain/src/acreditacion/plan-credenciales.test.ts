import { describe, expect, it } from 'vitest';
import { planCredenciales } from './acreditacion';

describe('[OR-50] [OP-15] plan de credenciales', () => {
  it('emite una por bailarín y una por persona y tipo, con zonas del evento', () => {
    const nuevas = planCredenciales(
      [
        { tipo: 'BAILARIN', nombre: 'Ana', academiaId: 'a1', bailarinId: 'b1' },
        { tipo: 'BAILARIN', nombre: 'Ana', academiaId: 'a1', bailarinId: 'b1' },
        { tipo: 'PROFESOR', nombre: 'Prof', academiaId: 'a1', usuarioId: 'u1' },
        { tipo: 'JURADO', nombre: 'Jur', usuarioId: 'u2' },
      ],
      [],
      { zonasPorTipo: { BAILARIN: ['BACKSTAGE'], JURADO: ['JURADO', 'BACKSTAGE'] } },
    );
    expect(nuevas.map((n) => [n.tipo, n.zonas])).toEqual([
      ['BAILARIN', ['BACKSTAGE']],
      ['PROFESOR', []],
      ['JURADO', ['JURADO', 'BACKSTAGE']],
    ]);
  });
  it('no duplica las ya emitidas ni candidatos sin persona', () => {
    expect(
      planCredenciales(
        [
          { tipo: 'BAILARIN', nombre: 'Ana', bailarinId: 'b1' },
          { tipo: 'STAFF', nombre: 'Sin cuenta' },
          { tipo: 'STAFF', nombre: 'Staff', usuarioId: 'u3' },
        ],
        [
          { tipo: 'BAILARIN', bailarinId: 'b1', usuarioId: null },
          { tipo: 'STAFF', bailarinId: null, usuarioId: 'u3' },
        ],
        {},
      ),
    ).toEqual([]);
  });
});
