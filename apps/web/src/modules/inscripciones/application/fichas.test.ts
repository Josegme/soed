import { fechaISO, PRESET_ENCUENTRO_2026, type ResultadoValidacion } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { enviarFicha, revalidarFicha, type EventoParaValidar, type FichaParaValidar, type PuertosFicha } from './fichas';

const evento: EventoParaValidar = {
  id: 'e1',
  reglamento: PRESET_ENCUENTRO_2026,
  reglamentoVersion: 3,
  fechaInicio: fechaISO('2026-04-30'),
  fechaFin: fechaISO('2026-05-04'),
  inscripcionApertura: '2025-08-10T00:00:00Z',
  inscripcionCierre: '2026-04-20T00:00:00Z',
  modificacionesCierre: '2026-04-25T00:00:00Z',
};

const ficha = (over: Partial<FichaParaValidar> = {}): FichaParaValidar => ({
  id: 'f1',
  eventoId: 'e1',
  academiaId: 'a1',
  estado: 'BORRADOR',
  bloqueada: false,
  genero: 'JAZZ',
  formacion: 'SOLO',
  categoriaDeclarada: null,
  duracionMusicaSegundos: 170,
  tieneExcepcion: false,
  integrantes: [{ bailarinId: 'b1', fechaNacimiento: fechaISO('2012-01-01') }],
  ...over,
});

function fake(f: FichaParaValidar | null, permisos = { academia: true, gestor: false }) {
  const registro: { guardadas: [string, ResultadoValidacion, number, string | undefined][]; enviadas: string[] } = { guardadas: [], enviadas: [] };
  const puertos: PuertosFicha = {
    leerFicha: async () => f,
    leerEvento: async (id) => (id === 'e1' ? evento : null),
    puedeEditar: async () => permisos,
    guardarValidacion: async (id, r, v, e) => void registro.guardadas.push([id, r, v, e]),
    marcarEnviada: async (id) => void registro.enviadas.push(id),
  };
  return { puertos, registro };
}

const enVentana = new Date('2026-01-10T12:00:00Z');

describe('[PR-12] [TR-11] revalidar ficha', () => {
  it('guarda la validación con la versión vigente del reglamento', async () => {
    const { puertos, registro } = fake(ficha());
    const r = await revalidarFicha(puertos, 'f1');
    expect(r.ok && r.value.categoria).toBe('INFANTO_JUVENIL');
    expect(registro.guardadas[0]?.[2]).toBe(3);
  });
  it('[TR-11] una ficha enviada que deja de cumplir pasa a observada', async () => {
    const { puertos, registro } = fake(ficha({ estado: 'ENVIADA', duracionMusicaSegundos: 500 }));
    await revalidarFicha(puertos, 'f1');
    expect(registro.guardadas[0]?.[3]).toBe('OBSERVADA');
    const conExcepcion = fake(ficha({ estado: 'ENVIADA', duracionMusicaSegundos: 500, tieneExcepcion: true }));
    await revalidarFicha(conExcepcion.puertos, 'f1');
    expect(conExcepcion.registro.guardadas[0]?.[3]).toBeUndefined();
  });
  it('rechaza fichas inexistentes, eventos inexistentes y usuarios sin permiso', async () => {
    expect(await revalidarFicha(fake(null).puertos, 'x')).toMatchObject({ ok: false, error: { codigo: 'FICHA_INEXISTENTE' } });
    expect(await revalidarFicha(fake(ficha({ eventoId: 'otro' })).puertos, 'f1')).toMatchObject({ ok: false, error: { codigo: 'EVENTO_INEXISTENTE' } });
    expect(await revalidarFicha(fake(ficha(), { academia: false, gestor: false }).puertos, 'f1')).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });
});

describe('[PR-12] [PR-19] enviar ficha', () => {
  it('envía una ficha válida dentro de la ventana', async () => {
    const { puertos, registro } = fake(ficha());
    expect((await enviarFicha(puertos, 'f1', enVentana)).ok).toBe(true);
    expect(registro.enviadas).toEqual(['f1']);
  });
  it('no envía una ficha inválida pero guarda la validación para mostrar las infracciones', async () => {
    const { puertos, registro } = fake(ficha({ duracionMusicaSegundos: 400 }));
    expect(await enviarFicha(puertos, 'f1', enVentana)).toMatchObject({ ok: false, error: { codigo: 'FICHA_INVALIDA' } });
    expect(registro.guardadas).toHaveLength(1);
    expect(registro.enviadas).toEqual([]);
  });
  it('[OR-22] con excepción del organizador se envía aunque no cumpla', async () => {
    const { puertos, registro } = fake(ficha({ duracionMusicaSegundos: 400, tieneExcepcion: true }));
    expect((await enviarFicha(puertos, 'f1', enVentana)).ok).toBe(true);
    expect(registro.enviadas).toEqual(['f1']);
  });
  it('[OR-23] la academia no envía con la ficha bloqueada o la ventana cerrada', async () => {
    expect(await enviarFicha(fake(ficha({ bloqueada: true })).puertos, 'f1', enVentana)).toMatchObject({ ok: false, error: { codigo: 'FICHA_NO_MODIFICABLE' } });
    expect(await enviarFicha(fake(ficha()).puertos, 'f1', new Date('2026-04-26T00:00:00Z'))).toMatchObject({ ok: false, error: { codigo: 'FICHA_NO_MODIFICABLE' } });
  });
  it('el organizador puede enviar fuera de término', async () => {
    const { puertos } = fake(ficha({ bloqueada: true }), { academia: false, gestor: true });
    expect((await enviarFicha(puertos, 'f1', new Date('2026-04-26T00:00:00Z'))).ok).toBe(true);
  });
  it('[PR-21] no envía una ficha retirada', async () => {
    expect(await enviarFicha(fake(ficha({ estado: 'RETIRADA' })).puertos, 'f1', enVentana)).toMatchObject({ ok: false, error: { codigo: 'FICHA_RETIRADA' } });
  });
});
