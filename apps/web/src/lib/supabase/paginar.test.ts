import { describe, expect, it } from 'vitest';
import { enLotes, leerTodo } from './paginar';

describe('lectura paginada', () => {
  it('pide páginas hasta recibir una incompleta', async () => {
    const datos = Array.from({ length: 5 }, (_, i) => i);
    const pedidos: [number, number][] = [];
    const filas = await leerTodo(async (desde, hasta) => {
      pedidos.push([desde, hasta]);
      return { data: datos.slice(desde, hasta + 1), error: null };
    }, 2);
    expect(filas).toEqual(datos);
    expect(pedidos).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ]);
  });

  it('propaga el error de la base', async () => {
    await expect(leerTodo(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });

  it('parte en lotes', () => {
    expect(enLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
