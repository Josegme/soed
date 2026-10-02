import { describe, expect, it } from 'vitest';
import { historialTemporada, resumirTemporada } from './resumen';

describe('[SA-10] [SA-11] tablero de temporada', () => {
  const resumen = resumirTemporada({
    eventoIds: ['brl', 'ars', 'vacio'],
    inscripciones: [
      { eventoId: 'brl', academiaId: 'a1' },
      { eventoId: 'brl', academiaId: 'a2' },
      { eventoId: 'ars', academiaId: 'a1' },
    ],
    fichas: [
      { eventoId: 'brl', estado: 'APROBADA' },
      { eventoId: 'brl', estado: 'ENVIADA' },
      { eventoId: 'brl', estado: 'BORRADOR' },
      { eventoId: 'ars', estado: 'RETIRADA' },
      { eventoId: 'ars', estado: 'OBSERVADA' },
    ],
    cobranza: [
      { eventoId: 'brl', moneda: 'BRL', esperado: 10_000, cobrado: 2_500, pendiente: 7_500, liquidaciones: 2 },
      { eventoId: 'ars', moneda: 'ARS', esperado: 0, cobrado: 0, pendiente: 0, liquidaciones: 1 },
    ],
  });

  it('cuenta academias únicas en la temporada y por evento', () => {
    expect(resumen.academias).toBe(2);
    expect(resumen.eventos.map((e) => e.academias)).toEqual([2, 1, 0]);
  });

  it('solo cuenta fichas que participan (sin borradores ni retiradas)', () => {
    expect(resumen.fichas).toBe(3);
    expect(resumen.eventos[0]).toMatchObject({ fichas: 2, fichasAprobadas: 1 });
    expect(resumen.eventos[1]).toMatchObject({ fichas: 1, fichasAprobadas: 0 });
  });

  it('no suma monedas distintas y calcula el avance de cobro', () => {
    expect(resumen.totales).toEqual([
      { moneda: 'ARS', esperado: 0, cobrado: 0, pendiente: 0, avance: 0 },
      { moneda: 'BRL', esperado: 10_000, cobrado: 2_500, pendiente: 7_500, avance: 25 },
    ]);
  });
});

describe('[SA-15] historial de la temporada', () => {
  it('vincula los pases vigentes desde el evento de origen y ordena por academia y fecha', () => {
    const filas = historialTemporada(
      [
        {
          academiaId: 'b',
          academia: 'Beta',
          coreografiaId: 'c3',
          coreografia: 'Solo',
          eventoId: 'e2',
          grupo: 'g',
          puesto: 1,
          puntaje: 9.1,
          banda: 'ORO',
        },
        {
          academiaId: 'a',
          academia: 'Alfa',
          coreografiaId: 'c1',
          coreografia: 'Dúo',
          eventoId: 'e2',
          grupo: 'g',
          puesto: 2,
          puntaje: 8.2,
          banda: 'PLATA',
        },
        {
          academiaId: 'a',
          academia: 'Alfa',
          coreografiaId: 'c1',
          coreografia: 'Dúo',
          eventoId: 'e1',
          grupo: 'g',
          puesto: 1,
          puntaje: 9.4,
          banda: 'ORO',
        },
      ],
      [
        { origenId: 'e1', destino: 'Final', academiaId: 'a', coreografiaId: 'c1' },
        { origenId: 'e2', destino: 'Final', academiaId: 'a', coreografiaId: 'c9' },
      ],
      ['e1', 'e2'],
    );
    expect(filas.map((f) => [f.academia, f.eventoId, f.pases])).toEqual([
      ['Alfa', 'e1', ['Final']],
      ['Alfa', 'e2', []],
      ['Beta', 'e2', []],
    ]);
  });
});
