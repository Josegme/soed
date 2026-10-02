import { describe, expect, it } from 'vitest';
import { horarioEstimado, moverABloque, proponerOrden, reordenar, transicionEstado, type ItemOrden } from './orden';

const items = (n: number, bloqueId = 'B1'): ItemOrden[] =>
  Array.from({ length: n }, (_, i) => ({ id: `i${i + 1}`, fichaId: `f${i + 1}`, bloqueId, posicion: i + 1, estado: 'PROGRAMADA' }));

describe('[OR-38] [OP-08] reordenar', () => {
  it('mueve hacia arriba y renumera de forma contigua', () => {
    const r = reordenar(items(4), 'i4', 1);
    expect(r.ok && r.value.map((i) => `${i.id}:${i.posicion}`)).toEqual(['i4:1', 'i1:2', 'i2:3', 'i3:4']);
  });
  it('mueve hacia abajo', () => {
    const r = reordenar(items(4), 'i1', 3);
    expect(r.ok && r.value.map((i) => i.id)).toEqual(['i2', 'i3', 'i1', 'i4']);
  });
  it('rechaza ítems inexistentes y posiciones fuera de rango', () => {
    expect(reordenar(items(3), 'x', 1)).toMatchObject({ ok: false, error: { codigo: 'ITEM_INEXISTENTE' } });
    expect(reordenar(items(3), 'i1', 4)).toMatchObject({ ok: false, error: { codigo: 'POSICION_INVALIDA' } });
    expect(reordenar(items(3), 'i1', 0)).toMatchObject({ ok: false });
  });
});

describe('[OP-09] mover entre bloques o pistas', () => {
  it('saca del origen, inserta en destino y renumera ambos', () => {
    const r = moverABloque(
      items(3, 'B1'),
      items(2, 'B2').map((i) => ({ ...i, id: `d${i.posicion}` })),
      'i2',
      'B2',
      1,
    );
    expect(r.ok && r.value.origen.map((i) => `${i.id}:${i.posicion}`)).toEqual(['i1:1', 'i3:2']);
    expect(r.ok && r.value.destino.map((i) => `${i.id}:${i.bloqueId}:${i.posicion}`)).toEqual(['i2:B2:1', 'd1:B2:2', 'd2:B2:3']);
  });
  it('valida ítem y posición', () => {
    expect(moverABloque(items(1), [], 'x', 'B2', 1)).toMatchObject({ ok: false, error: { codigo: 'ITEM_INEXISTENTE' } });
    expect(moverABloque(items(1), [], 'i1', 'B2', 3)).toMatchObject({ ok: false, error: { codigo: 'POSICION_INVALIDA' } });
  });
});

describe('[OP-07] transiciones de estado en vivo', () => {
  it('permite el flujo normal y correcciones', () => {
    expect(transicionEstado('PROGRAMADA', 'LLAMADA')).toEqual({ ok: true, value: 'LLAMADA' });
    expect(transicionEstado('EN_ESCENA', 'PRESENTADA').ok).toBe(true);
    expect(transicionEstado('PRESENTADA', 'EN_ESCENA').ok).toBe(true);
    expect(transicionEstado('AUSENTE', 'PROGRAMADA').ok).toBe(true);
  });
  it('rechaza saltos inválidos', () => {
    expect(transicionEstado('PROGRAMADA', 'PRESENTADA')).toMatchObject({ ok: false, error: { codigo: 'TRANSICION_INVALIDA' } });
    expect(transicionEstado('PRESENTADA', 'AUSENTE').ok).toBe(false);
  });
});

describe('[OP-10] horario estimado', () => {
  it('acumula duración e intervalo y omite presentadas y ausentes', () => {
    const lista: ItemOrden[] = [
      { ...items(1)[0]!, id: 'a', posicion: 1, estado: 'PRESENTADA', duracionSegundos: 200 },
      { ...items(1)[0]!, id: 'b', posicion: 2, duracionSegundos: 180 },
      { ...items(1)[0]!, id: 'c', posicion: 3, estado: 'AUSENTE' },
      { ...items(1)[0]!, id: 'd', posicion: 4, duracionSegundos: null },
    ];
    const inicio = new Date('2026-04-30T18:00:00Z');
    const h = horarioEstimado(lista, inicio, { intervaloSegundos: 60, duracionPorDefectoSegundos: 240 });
    expect(h.map((x) => [x.itemId, x.inicio.toISOString()])).toEqual([
      ['b', '2026-04-30T18:00:00.000Z'],
      ['d', '2026-04-30T18:04:00.000Z'],
    ]);
    const tarde = horarioEstimado(lista, inicio, {
      intervaloSegundos: 0,
      duracionPorDefectoSegundos: 240,
      ahora: new Date('2026-04-30T18:30:00Z'),
    });
    expect(tarde[0]?.inicio.toISOString()).toBe('2026-04-30T18:30:00.000Z');
  });
});

describe('[OR-37] propuesta de orden', () => {
  it('agrupa por categoría, formación y género y separa academias consecutivas', () => {
    const orden = proponerOrden(
      [
        { fichaId: 'g1', categoriaOrden: 2, formacion: 'GRUPO', genero: 'JAZZ', academia: 'A' },
        { fichaId: 's1', categoriaOrden: 1, formacion: 'SOLO', genero: 'JAZZ', academia: 'A' },
        { fichaId: 's2', categoriaOrden: 1, formacion: 'SOLO', genero: 'JAZZ', academia: 'A' },
        { fichaId: 's3', categoriaOrden: 1, formacion: 'SOLO', genero: 'JAZZ', academia: 'B' },
        { fichaId: 'x1', categoriaOrden: 1, formacion: 'OTRA', genero: 'BALLET', academia: 'C' },
      ],
      ['SOLO', 'DUO', 'TRIO', 'GRUPO'],
    );
    expect(orden).toEqual(['s1', 's3', 's2', 'x1', 'g1']);
  });
});
