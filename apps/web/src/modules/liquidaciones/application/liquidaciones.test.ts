import type { CalculoLiquidacion } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { emitirLiquidacion, liquidacionPrevia, type InscripcionParaLiquidar, type PuertosLiquidacion, type VersionEmitida } from './liquidaciones';

const inscripcion = (over: Partial<InscripcionParaLiquidar> = {}): InscripcionParaLiquidar => ({
  id: 'i1',
  eventoId: 'e1',
  academiaId: 'a1',
  tarifario: { moneda: 'BRL', porBailarin: { precio: 10000 }, porCoreografia: { precioBase: 5000 } },
  fichas: [
    { id: 'f1', formacion: 'SOLO', genero: 'JAZZ', categoria: 'JUVENIL', estado: 'ENVIADA', integrantes: [{ bailarinId: 'b1' }] },
    { id: 'f2', formacion: 'SOLO', genero: 'JAZZ', categoria: 'JUVENIL', estado: 'BORRADOR', integrantes: [{ bailarinId: 'b2' }] },
  ],
  rubros: [],
  ajustes: [],
  beneficios: [],
  ...over,
});

function fake(i: InscripcionParaLiquidar | null, puedeVer = true) {
  const versiones: VersionEmitida[] = [];
  const puertos: PuertosLiquidacion = {
    leerInscripcion: async () => i,
    puedeVer: async () => puedeVer,
    ultimaVersion: async () => versiones.at(-1) ?? null,
    asegurarLiquidacion: async () => ({ id: 'l1', numero: 'LIQ-SELA-0001' }),
    insertarVersion: async (d) => void versiones.push({ version: d.version, totalCentavos: d.calculo.total, detalle: d.calculo as CalculoLiquidacion }),
  };
  return { puertos, versiones };
}

describe('[PR-13] liquidación en vivo', () => {
  it('incluye borradores en la vista previa', async () => {
    const r = await liquidacionPrevia(fake(inscripcion()).puertos, 'i1');
    expect(r.ok && r.value.total).toBe(2 * 10000 + 2 * 5000);
  });
  it('requiere tarifario y permiso', async () => {
    expect(await liquidacionPrevia(fake(inscripcion({ tarifario: null })).puertos, 'i1')).toMatchObject({ ok: false, error: { codigo: 'SIN_TARIFARIO' } });
    expect(await liquidacionPrevia(fake(inscripcion(), false).puertos, 'i1')).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
    expect(await liquidacionPrevia(fake(null).puertos, 'i1')).toMatchObject({ ok: false, error: { codigo: 'INSCRIPCION_INEXISTENTE' } });
  });
});

describe('[PR-15] [TR-18] emisión versionada', () => {
  it('emite la versión 1 solo con fichas enviadas y no duplica si nada cambió', async () => {
    const { puertos, versiones } = fake(inscripcion());
    expect(await emitirLiquidacion(puertos, 'i1', 'es')).toEqual({ ok: true, value: { numero: 'LIQ-SELA-0001', version: 1, totalCentavos: 15000, nueva: true } });
    expect(await emitirLiquidacion(puertos, 'i1', 'es')).toMatchObject({ ok: true, value: { version: 1, nueva: false } });
    expect(versiones).toHaveLength(1);
  });
  it('crea una versión nueva si la academia agrega coreografías', async () => {
    const datos = inscripcion();
    const { puertos } = fake(datos);
    await emitirLiquidacion(puertos, 'i1', 'es');
    datos.fichas[1] = { ...datos.fichas[1]!, estado: 'ENVIADA' };
    expect(await emitirLiquidacion(puertos, 'i1', 'pt-BR')).toMatchObject({ ok: true, value: { version: 2, totalCentavos: 30000 } });
  });
  it('[OR-34] aplica el beneficio de un pase', async () => {
    const { puertos } = fake(inscripcion({ beneficios: [{ beneficio: { tipo: 'BECA' }, motivo: 'Pase' }] }));
    expect(await emitirLiquidacion(puertos, 'i1', 'es')).toMatchObject({ ok: true, value: { totalCentavos: 0 } });
  });
  it('informa cálculos inválidos', async () => {
    const { puertos } = fake(inscripcion({ rubros: [{ codigo: 'X', cantidad: 1 }] }));
    expect(await emitirLiquidacion(puertos, 'i1', 'es')).toMatchObject({ ok: false, error: { codigo: 'CALCULO_INVALIDO', params: { causa: 'RUBRO_DESCONOCIDO' } } });
  });
});
