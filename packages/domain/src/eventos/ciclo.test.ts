import { describe, expect, it } from 'vitest';
import { transicionEvento, transicionesPosibles } from './ciclo';

describe('[OR-02] [SA-08] ciclo de vida del evento', () => {
  it('publicar lo hace visible y volver a borrador lo oculta', () => {
    expect(transicionEvento('BORRADOR', 'PUBLICADO', false)).toEqual({ ok: true, value: { estado: 'PUBLICADO', publicado: true } });
    expect(transicionEvento('PUBLICADO', 'BORRADOR', false)).toEqual({ ok: true, value: { estado: 'BORRADOR', publicado: false } });
  });
  it('no salta etapas', () => {
    expect(transicionEvento('BORRADOR', 'FINALIZADO', true)).toMatchObject({ ok: false, error: { codigo: 'TRANSICION_INVALIDA' } });
  });
  it('[SA-17] archivar y desarchivar es exclusivo del Super Admin', () => {
    expect(transicionEvento('FINALIZADO', 'ARCHIVADO', false)).toMatchObject({ ok: false, error: { codigo: 'SOLO_SUPER_ADMIN' } });
    expect(transicionEvento('FINALIZADO', 'ARCHIVADO', true)).toEqual({ ok: true, value: { estado: 'ARCHIVADO', publicado: false } });
    expect(transicionesPosibles('ARCHIVADO', false)).toEqual([]);
    expect(transicionesPosibles('FINALIZADO', false)).toEqual(['EN_CURSO']);
  });
});
