import { PRESET_ENCUENTRO_2026 } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { crearEvento, type ConfiguracionClonable, type NuevoEvento, type PuertosEventos } from './crear-evento';

const nuevo: NuevoEvento = {
  temporadaId: 't1',
  slug: 'SEL2',
  tipo: 'SELECTIVO',
  nombre: { es: 'Sel 2' },
  moneda: 'ARS',
  idiomaDefecto: 'es',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  fechaInicio: '2027-03-01',
  fechaFin: '2027-03-02',
  sede: {},
};
const origen: ConfiguracionClonable = {
  reglamento: PRESET_ENCUENTRO_2026,
  tarifario: { moneda: 'BRL', porBailarin: { precio: 100 } },
  mediosCobro: ['PIX'],
  datosPago: { es: 'x' },
  bases: {},
  configOperacion: {},
  criterios: [{ codigo: 'TECNICA', nombre: { es: 'Técnica' }, peso: 1, orden: 1 }],
  pistas: [],
};

function fake(opc: { admin?: boolean; slugLibre?: boolean; reglamento?: boolean } = {}) {
  const insertados: [NuevoEvento, ConfiguracionClonable][] = [];
  const p: PuertosEventos = {
    esSuperAdmin: () => opc.admin ?? true,
    reglamentoDeTemporada: async () => (opc.reglamento === false ? null : PRESET_ENCUENTRO_2026),
    configuracionDe: async (id) => (id === 'e0' ? origen : null),
    slugDisponible: async () => opc.slugLibre ?? true,
    insertarEvento: async (e, c) => {
      insertados.push([e, c]);
      return 'nuevo';
    },
  };
  return { p, insertados };
}

describe('[SA-02] [SA-03] crear y clonar eventos', () => {
  it('crea con snapshot del reglamento de la temporada', async () => {
    const { p, insertados } = fake();
    expect(await crearEvento(p, nuevo)).toEqual({ ok: true, value: { eventoId: 'nuevo' } });
    expect(insertados[0]?.[1].reglamento.preset).toBe('encuentro-2026');
  });
  it('clona configuración y alinea la moneda del tarifario', async () => {
    const { p, insertados } = fake();
    await crearEvento(p, { ...nuevo, clonarDeEventoId: 'e0' });
    expect(insertados[0]?.[1].tarifario).toMatchObject({ moneda: 'ARS', porBailarin: { precio: 100 } });
    expect(insertados[0]?.[1].criterios).toHaveLength(1);
  });
  it('rechaza sin permiso, slug en uso, origen o reglamento inexistentes', async () => {
    expect(await crearEvento(fake({ admin: false }).p, nuevo)).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
    expect(await crearEvento(fake({ slugLibre: false }).p, nuevo)).toMatchObject({ ok: false, error: { codigo: 'SLUG_EN_USO' } });
    expect(await crearEvento(fake().p, { ...nuevo, clonarDeEventoId: 'zz' })).toMatchObject({
      ok: false,
      error: { codigo: 'EVENTO_ORIGEN_INEXISTENTE' },
    });
    expect(await crearEvento(fake({ reglamento: false }).p, nuevo)).toMatchObject({ ok: false, error: { codigo: 'SIN_REGLAMENTO' } });
  });
});
