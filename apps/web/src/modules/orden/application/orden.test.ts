import type { EstadoOrden } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { asignarFichasABloque, avanzarOrden, cambiarEstadoOrden, type PuertosOrden } from './orden';

function fake(
  permisos = ['orden.editar', 'orden.operar'],
  estado: EstadoOrden = 'PROGRAMADA',
  pista: { id: string; eventoId: string; estado: EstadoOrden }[] = [],
) {
  const insertados: unknown[] = [];
  const cambios: string[] = [];
  const p: PuertosOrden = {
    puede: (_e, perm) => permisos.includes(perm),
    fichasSinOrden: async () => [
      { fichaId: 'g', categoriaOrden: 2, formacion: 'GRUPO', genero: 'JAZZ', academia: 'A' },
      { fichaId: 's', categoriaOrden: 1, formacion: 'SOLO', genero: 'JAZZ', academia: 'A' },
    ],
    ordenFormaciones: async () => ['SOLO', 'GRUPO'],
    ultimaPosicion: async () => 3,
    bloque: async (id) => (id === 'b1' ? { id: 'b1', eventoId: 'e1', pistaId: 'p1' } : null),
    insertarItems: async (items) => void insertados.push(...items),
    item: async (id) => (id === 'i1' ? { id: 'i1', eventoId: 'e1', estado } : null),
    actualizarEstado: async (id, e) => void cambios.push(pista.length ? `${id}:${e}` : e),
    liberarEscena: async () => void cambios.push('LIBERAR'),
    itemsDePista: async () => pista,
  };
  return { p, insertados, cambios };
}

describe('[OR-37] asignar fichas a un bloque', () => {
  it('agrega al final en el orden propuesto por el dominio', async () => {
    const { p, insertados } = fake();
    expect(await asignarFichasABloque(p, 'b1')).toEqual({ ok: true, value: { agregadas: 2 } });
    expect(insertados).toEqual([
      { eventoId: 'e1', pistaId: 'p1', bloqueId: 'b1', fichaId: 's', posicion: 4 },
      { eventoId: 'e1', pistaId: 'p1', bloqueId: 'b1', fichaId: 'g', posicion: 5 },
    ]);
  });
  it('valida bloque y permiso', async () => {
    expect(await asignarFichasABloque(fake().p, 'x')).toMatchObject({ ok: false, error: { codigo: 'BLOQUE_INEXISTENTE' } });
    expect(await asignarFichasABloque(fake([]).p, 'b1')).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });
});

describe('[OP-07] cambiar estado en vivo', () => {
  it('libera la escena antes de subir otra coreografía', async () => {
    const { p, cambios } = fake();
    expect(await cambiarEstadoOrden(p, 'i1', 'EN_ESCENA')).toEqual({ ok: true, value: 'EN_ESCENA' });
    expect(cambios).toEqual(['LIBERAR', 'EN_ESCENA']);
  });
  it('rechaza transiciones inválidas y sin permiso', async () => {
    expect(await cambiarEstadoOrden(fake().p, 'i1', 'PRESENTADA')).toMatchObject({ ok: false, error: { codigo: 'TRANSICION_INVALIDA' } });
    expect(await cambiarEstadoOrden(fake(['orden.editar']).p, 'i1', 'LLAMADA')).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
    expect(await cambiarEstadoOrden(fake().p, 'x', 'LLAMADA')).toMatchObject({ ok: false, error: { codigo: 'ITEM_INEXISTENTE' } });
  });
});

describe('[OP-06] [OP-07] siguiente en escena', () => {
  const item = (id: string, estado: EstadoOrden) => ({ id, eventoId: 'e1', estado });
  it('presenta la actual, sube la llamada y llama a la próxima', async () => {
    const { p, cambios } = fake(undefined, undefined, [
      item('a', 'PRESENTADA'),
      item('b', 'EN_ESCENA'),
      item('c', 'LLAMADA'),
      item('d', 'PROGRAMADA'),
    ]);
    expect(await avanzarOrden(p, 'p1')).toEqual({ ok: true, value: { enEscena: 'c', llamada: 'd' } });
    expect(cambios).toEqual(['b:PRESENTADA', 'c:EN_ESCENA', 'd:LLAMADA']);
  });
  it('arranca el bloque y saltea ausentes', async () => {
    const { p, cambios } = fake(undefined, undefined, [item('a', 'AUSENTE'), item('b', 'PROGRAMADA'), item('c', 'PROGRAMADA')]);
    expect(await avanzarOrden(p, 'p1')).toEqual({ ok: true, value: { enEscena: 'b', llamada: 'c' } });
    expect(cambios).toEqual(['b:EN_ESCENA', 'c:LLAMADA']);
  });
  it('al final solo presenta la última y exige permiso de operación', async () => {
    const { p, cambios } = fake(undefined, undefined, [item('a', 'EN_ESCENA')]);
    expect(await avanzarOrden(p, 'p1')).toEqual({ ok: true, value: { enEscena: null, llamada: null } });
    expect(cambios).toEqual(['a:PRESENTADA']);
    expect(await avanzarOrden(fake(['orden.editar'], undefined, [item('a', 'EN_ESCENA')]).p, 'p1')).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
  });
});
