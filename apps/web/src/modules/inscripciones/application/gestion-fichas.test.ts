import { describe, expect, it } from 'vitest';
import { gestionarFicha, type FichaParaGestion, type PuertosGestionFicha } from './gestion-fichas';

function fake(f: Partial<FichaParaGestion> = {}, permiso = true) {
  const cambios: Record<string, unknown>[] = [];
  const ficha: FichaParaGestion = {
    id: 'f1',
    eventoId: 'e1',
    estado: 'ENVIADA',
    valida: true,
    tieneExcepcion: false,
    infracciones: [],
    ...f,
  };
  const p: PuertosGestionFicha = {
    leer: async (id) => (id === 'f1' ? ficha : null),
    puedeGestionar: () => permiso,
    usuarioId: () => 'org',
    actualizar: async (_id, c) => void cambios.push(c),
  };
  return { p, cambios };
}
const ahora = new Date('2026-04-01T12:00:00Z');

describe('[OR-21] [OR-22] [OR-23] gestión de fichas por el organizador', () => {
  it('aprueba solo fichas válidas o con excepción', async () => {
    expect(await gestionarFicha(fake().p, { accion: 'APROBAR', fichaId: 'f1' }, ahora)).toEqual({ ok: true, value: true });
    expect(await gestionarFicha(fake({ valida: false }).p, { accion: 'APROBAR', fichaId: 'f1' }, ahora)).toMatchObject({
      ok: false,
      error: { codigo: 'FICHA_INVALIDA' },
    });
    expect((await gestionarFicha(fake({ valida: false, tieneExcepcion: true }).p, { accion: 'APROBAR', fichaId: 'f1' }, ahora)).ok).toBe(
      true,
    );
  });
  it('registra la excepción con autor, fecha e infracciones y deja la ficha enviada', async () => {
    const { p, cambios } = fake({ estado: 'OBSERVADA', valida: false, infracciones: [{ codigo: 'DURACION_EXCEDIDA' }] });
    await gestionarFicha(p, { accion: 'EXCEPCION', fichaId: 'f1', motivo: 'Música autorizada por la dirección' }, ahora);
    expect(cambios[0]).toEqual({
      excepcion: { motivo: 'Música autorizada por la dirección', por: 'org', at: ahora.toISOString(), infracciones: ['DURACION_EXCEDIDA'] },
      estado: 'ENVIADA',
    });
    expect(await gestionarFicha(p, { accion: 'EXCEPCION', fichaId: 'f1', motivo: 'no' }, ahora)).toMatchObject({
      ok: false,
      error: { codigo: 'MOTIVO_REQUERIDO' },
    });
  });
  it('observa, bloquea y respeta permisos y retiradas', async () => {
    const { p, cambios } = fake();
    await gestionarFicha(p, { accion: 'OBSERVAR', fichaId: 'f1', observacion: ' Falta música ' }, ahora);
    await gestionarFicha(p, { accion: 'BLOQUEAR', fichaId: 'f1', bloqueada: true }, ahora);
    expect(cambios).toEqual([{ estado: 'OBSERVADA', observacion: 'Falta música' }, { bloqueada: true }]);
    expect(await gestionarFicha(fake({}, false).p, { accion: 'APROBAR', fichaId: 'f1' }, ahora)).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
    expect(await gestionarFicha(fake({ estado: 'RETIRADA' }).p, { accion: 'APROBAR', fichaId: 'f1' }, ahora)).toMatchObject({
      ok: false,
      error: { codigo: 'FICHA_RETIRADA' },
    });
    expect(await gestionarFicha(fake().p, { accion: 'APROBAR', fichaId: 'zz' }, ahora)).toMatchObject({
      ok: false,
      error: { codigo: 'FICHA_INEXISTENTE' },
    });
  });
});
