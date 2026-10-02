import { describe, expect, it } from 'vitest';
import { agruparCronogramaPorDia, type FilaCronogramaPublico } from './eventos-publicos';

const fila = (inicio: string, bloque: string): FilaCronogramaPublico => ({ pista: { es: 'Pista 1' }, bloque: { es: bloque }, inicio });

describe('[PU-06] cronograma público', () => {
  it('agrupa los bloques por día local de la sede, no por día UTC', () => {
    const dias = agruparCronogramaPorDia(
      [fila('2027-05-02T01:30:00Z', 'Noche'), fila('2027-05-01T12:00:00Z', 'Mañana'), fila('2027-05-02T13:00:00Z', 'Día 2')],
      'America/Sao_Paulo',
    );
    expect(dias.map((d) => d.dia)).toEqual(['2027-05-01', '2027-05-02']);
    expect(dias[0]?.bloques.map((b) => b.bloque.es)).toEqual(['Mañana', 'Noche']);
    expect(dias[1]?.bloques.map((b) => b.bloque.es)).toEqual(['Día 2']);
  });

  it('sin bloques con horario no hay cronograma', () => {
    expect(agruparCronogramaPorDia([], 'America/Argentina/Buenos_Aires')).toEqual([]);
  });
});
