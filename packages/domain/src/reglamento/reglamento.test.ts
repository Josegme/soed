import { describe, expect, it } from 'vitest';
import { fechaISO } from '../shared/fecha';
import {
  buscarCategoria,
  categoriaPorEdad,
  distanciaCategorias,
  edadYCategoria,
  fechaReferencia,
} from './categoria';
import { PRESET_ENCUENTRO_2026 as P } from './presets/encuentro-2026';
import { evaluarDuracion, tiempoMaximo } from './tiempo';
import { maximoFueraDeCategoria, sugerirCategoriasGrupo } from './tolerancia-grupo';
import type { ReglamentoEvento } from './tipos';
import { validarFicha, type FichaAValidar } from './validar-ficha';
import { validarReglamento } from './validar-reglamento';

const evento = { fechaInicio: fechaISO('2026-04-30'), fechaFin: fechaISO('2026-05-04') };

/** Fecha de nacimiento para que tenga `edad` años cumplidos al inicio del evento. */
const nacidoCon = (edad: number, desfaseDias = 0): ReturnType<typeof fechaISO> => {
  const d = new Date(Date.UTC(2026 - edad, 3, 30 - desfaseDias));
  return fechaISO(d.toISOString().slice(0, 10));
};

const integrantes = (edades: number[]) =>
  edades.map((edad, i) => ({ bailarinId: `b${i + 1}`, fechaNacimiento: nacidoCon(edad) }));

const ficha = (over: Partial<FichaAValidar>): FichaAValidar => ({
  formacion: 'SOLO',
  genero: 'JAZZ',
  integrantes: integrantes([12]),
  duracionMusicaSegundos: 170,
  ...over,
});

describe('[TR-10] preset encuentro-2026', () => {
  it('es internamente coherente', () => {
    expect(validarReglamento(P)).toEqual([]);
  });
  it('declara los parámetros no confirmados como supuestos', () => {
    expect(P.supuestos?.length).toBeGreaterThan(0);
  });
});

describe('[TR-02] categoría por edad completa a la fecha del evento', () => {
  it('usa la fecha de inicio del evento como referencia por defecto', () => {
    expect(fechaReferencia(P, evento)).toBe('2026-04-30');
  });
  it('admite fin de evento, fin de año y fecha fija', () => {
    expect(fechaReferencia({ ...P, fechaReferenciaEdad: { tipo: 'FIN_EVENTO' } }, evento)).toBe('2026-05-04');
    expect(fechaReferencia({ ...P, fechaReferenciaEdad: { tipo: 'FIN_DE_ANIO' } }, evento)).toBe('2026-12-31');
    expect(
      fechaReferencia({ ...P, fechaReferenciaEdad: { tipo: 'FECHA_FIJA', fecha: fechaISO('2026-01-01') } }, evento),
    ).toBe('2026-01-01');
  });
  it('cuenta la edad cumplida: quien cumple 11 el día del evento ya es Infanto-juvenil', () => {
    expect(edadYCategoria(P, evento, fechaISO('2015-04-30'))).toMatchObject({ edad: 11, categoria: { codigo: 'INFANTO_JUVENIL' } });
  });
  it('quien cumple 11 un día después del inicio sigue en Infantil', () => {
    expect(edadYCategoria(P, evento, fechaISO('2015-05-01'))).toMatchObject({ edad: 10, categoria: { codigo: 'INFANTIL' } });
  });
  it('la misma persona puede cambiar de categoría entre un selectivo y la final', () => {
    const nacimiento = fechaISO('2015-03-15');
    const selectivo = { fechaInicio: fechaISO('2026-02-01'), fechaFin: fechaISO('2026-02-02') };
    expect(edadYCategoria(P, selectivo, nacimiento).categoria?.codigo).toBe('INFANTIL');
    expect(edadYCategoria(P, evento, nacimiento).categoria?.codigo).toBe('INFANTO_JUVENIL');
  });
  it('40+ no tiene tope de edad', () => {
    expect(categoriaPorEdad(P, 75)?.codigo).toBe('ADULTO_40');
  });
  it('devuelve null fuera de todo rango', () => {
    expect(categoriaPorEdad(P, 2)).toBeNull();
  });
  it('calcula la distancia entre categorías y rechaza códigos desconocidos', () => {
    expect(distanciaCategorias(P, 'INFANTIL', 'JUVENIL')).toBe(-2);
    expect(() => distanciaCategorias(P, 'X', 'JUVENIL')).toThrow();
    expect(buscarCategoria(P, 'X')).toBeUndefined();
  });
});

describe('[TR-03] tolerancia de grupos del 30 %', () => {
  it('redondea según configuración', () => {
    const t = P.toleranciaGrupo;
    expect(maximoFueraDeCategoria(10, t)).toBe(3);
    expect(maximoFueraDeCategoria(7, t)).toBe(2);
    expect(maximoFueraDeCategoria(7, { ...t, redondeo: 'CEIL' })).toBe(3);
    expect(maximoFueraDeCategoria(5, { ...t, redondeo: 'ROUND' })).toBe(2);
    expect(maximoFueraDeCategoria(4, t)).toBe(1);
  });
  it('acepta un grupo de 10 con 3 integrantes fuera de categoría', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'GRUPO', categoriaDeclarada: 'JUVENIL', integrantes: integrantes([15, 16, 16, 17, 15, 16, 17, 14, 18, 13]), duracionMusicaSegundos: 280 }));
    expect(r.infracciones).toEqual([]);
    expect(r.categoria).toBe('JUVENIL');
  });
  it('rechaza un grupo de 10 con 4 integrantes fuera de categoría', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'GRUPO', categoriaDeclarada: 'JUVENIL', integrantes: integrantes([15, 16, 16, 17, 15, 16, 14, 14, 18, 13]), duracionMusicaSegundos: 280 }));
    expect(r.valida).toBe(false);
    expect(r.infracciones).toContainEqual({ codigo: 'TOLERANCIA_GRUPO_EXCEDIDA', params: { fueraDeCategoria: 4, maximoPermitido: 3, porcentaje: 30 } });
  });
  it('deduce la categoría del grupo si hay una sola posible', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'GRUPO', integrantes: integrantes([12, 12, 13, 14, 15]), duracionMusicaSegundos: 200 }));
    expect(r.categoria).toBe('INFANTO_JUVENIL');
    expect(r.infracciones).toEqual([]);
  });
  it('pide declarar la categoría si ninguna o varias son posibles', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'GRUPO', integrantes: integrantes([8, 9, 12, 13, 16, 17]), duracionMusicaSegundos: 200 }));
    expect(r.categoria).toBeNull();
    expect(r.infracciones.map((i) => i.codigo)).toContain('CATEGORIA_NO_DETERMINADA');
  });
  it('respeta la dirección y la adyacencia configuradas', () => {
    const estricto: ReglamentoEvento = { ...P, toleranciaGrupo: { porcentaje: 30, redondeo: 'FLOOR', direccion: 'SOLO_MENORES', soloAdyacentes: true } };
    const r = validarFicha(estricto, evento, ficha({ formacion: 'GRUPO', categoriaDeclarada: 'JUVENIL', integrantes: integrantes([15, 16, 17, 16, 15, 16, 19, 8, 15, 16]), duracionMusicaSegundos: 200 }));
    const codigos = r.infracciones.map((i) => i.codigo);
    expect(codigos).toContain('INTEGRANTE_FUERA_DE_DIRECCION');
    expect(codigos).toContain('INTEGRANTE_CATEGORIA_NO_ADYACENTE');
    const mayores: ReglamentoEvento = { ...P, toleranciaGrupo: { ...estricto.toleranciaGrupo, direccion: 'SOLO_MAYORES', soloAdyacentes: false } };
    const r2 = validarFicha(mayores, evento, ficha({ formacion: 'GRUPO', categoriaDeclarada: 'JUVENIL', integrantes: integrantes([15, 16, 17, 16, 14]), duracionMusicaSegundos: 200 }));
    expect(r2.infracciones.map((i) => i.codigo)).toEqual(['INTEGRANTE_FUERA_DE_DIRECCION']);
  });
  it('sugiere categorías ordenadas por cantidad de integrantes dentro', () => {
    const t: ReglamentoEvento = { ...P, toleranciaGrupo: { ...P.toleranciaGrupo, porcentaje: 50 } };
    const s = sugerirCategoriasGrupo(t, [
      { bailarinId: 'a', categoria: 'INFANTIL' },
      { bailarinId: 'b', categoria: 'INFANTIL' },
      { bailarinId: 'c', categoria: 'INFANTIL' },
      { bailarinId: 'd', categoria: 'JUVENIL' },
    ]);
    expect(s[0]).toEqual({ categoria: 'INFANTIL', dentroDeCategoria: 3 });
  });
});

describe('[TR-04] [TR-05] tiempos y tolerancia de tiempo', () => {
  it('usa 15 s de tolerancia en solo y 30 s en grupos', () => {
    expect(validarFicha(P, evento, ficha({ duracionMusicaSegundos: 195 })).advertencias).toContainEqual(
      expect.objectContaining({ codigo: 'DURACION_EN_TOLERANCIA' }),
    );
    expect(validarFicha(P, evento, ficha({ duracionMusicaSegundos: 196 })).infracciones).toContainEqual({
      codigo: 'DURACION_EXCEDIDA',
      params: { duracion: 196, maximo: 180, tolerancia: 15 },
    });
    const grupo = ficha({ formacion: 'GRUPO', integrantes: integrantes([20, 21, 22, 23]) });
    expect(validarFicha(P, evento, { ...grupo, duracionMusicaSegundos: 330 }).valida).toBe(true);
    expect(validarFicha(P, evento, { ...grupo, duracionMusicaSegundos: 331 }).valida).toBe(false);
  });
  it('[TR-09] el Quadro admite hasta 10 minutos', () => {
    const q = ficha({ formacion: 'QUADRO', integrantes: integrantes([20, 21, 22, 23, 24]), duracionMusicaSegundos: 600 });
    expect(validarFicha(P, evento, q).valida).toBe(true);
  });
  it('gana la regla más específica y, ante empate, la más estricta', () => {
    const r: ReglamentoEvento = {
      ...P,
      tiempos: [
        { formacion: 'SOLO', maxSegundos: 180 },
        { formacion: 'SOLO', genero: 'BALLET_CLASICO', maxSegundos: 240 },
        { formacion: 'SOLO', genero: 'BALLET_CLASICO', categoria: 'ADULTO', maxSegundos: 300 },
        { genero: 'JAZZ', maxSegundos: 200 },
        { formacion: 'DUO', maxSegundos: 150 },
      ],
    };
    expect(tiempoMaximo(r, { genero: 'BALLET_CLASICO', formacion: 'SOLO', categoria: 'ADULTO' })).toBe(300);
    expect(tiempoMaximo(r, { genero: 'BALLET_CLASICO', formacion: 'SOLO', categoria: 'JUVENIL' })).toBe(240);
    expect(tiempoMaximo(r, { genero: 'JAZZ', formacion: 'SOLO', categoria: 'JUVENIL' })).toBe(180);
    expect(tiempoMaximo(r, { genero: 'JAZZ', formacion: 'TRIO', categoria: null })).toBe(200);
    expect(tiempoMaximo({ ...P, tiempos: [] }, { genero: 'JAZZ', formacion: 'SOLO', categoria: null })).toBeNull();
  });
  it('evalúa la duración en los tres tramos', () => {
    expect(evaluarDuracion(180, 180, 15)).toBe('DENTRO');
    expect(evaluarDuracion(195, 180, 15)).toBe('EN_TOLERANCIA');
    expect(evaluarDuracion(196, 180, 15)).toBe('EXCEDIDA');
  });
  it('advierte si falta música o si no hay tiempo máximo configurado', () => {
    const sinMusica = validarFicha(P, evento, ficha({ duracionMusicaSegundos: null }));
    expect(sinMusica.advertencias.map((a) => a.codigo)).toContain('MUSICA_FALTANTE');
    expect(sinMusica.valida).toBe(true);
    const sinTiempos = validarFicha({ ...P, tiempos: [] }, evento, ficha({}));
    expect(sinTiempos.advertencias.map((a) => a.codigo)).toContain('SIN_TIEMPO_MAXIMO');
  });
});

describe('[TR-06] géneros restringidos por categoría', () => {
  it('Composições Coreográficas solo en 40+', () => {
    expect(validarFicha(P, evento, ficha({ genero: 'COMPOSICIONES_COREOGRAFICAS', integrantes: integrantes([45]) })).valida).toBe(true);
    expect(validarFicha(P, evento, ficha({ genero: 'COMPOSICIONES_COREOGRAFICAS', integrantes: integrantes([30]) })).infracciones).toContainEqual({
      codigo: 'GENERO_NO_HABILITADO_EN_CATEGORIA',
      params: { genero: 'COMPOSICIONES_COREOGRAFICAS', categoria: 'ADULTO' },
    });
  });
  it('Reggaeton desde Infantil', () => {
    expect(validarFicha(P, evento, ficha({ genero: 'REGGAETON', integrantes: integrantes([8]) })).valida).toBe(true);
    expect(validarFicha(P, evento, ficha({ genero: 'REGGAETON', integrantes: integrantes([5]) })).valida).toBe(false);
  });
  it('respeta un tope superior de categoría', () => {
    const r: ReglamentoEvento = { ...P, generos: [...P.generos, { codigo: 'BABY', nombre: { es: 'Baby' }, hastaCategoria: 'INFANTIL' }] };
    expect(validarFicha(r, evento, ficha({ genero: 'BABY', integrantes: integrantes([9]) })).valida).toBe(true);
    expect(validarFicha(r, evento, ficha({ genero: 'BABY', integrantes: integrantes([12]) })).valida).toBe(false);
  });
});

describe('[TR-07] [PR-12] validación de ficha', () => {
  it('dúo y trío compiten en la categoría del integrante mayor', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'DUO', integrantes: integrantes([9, 12]), duracionMusicaSegundos: 200 }));
    expect(r.categoria).toBe('INFANTO_JUVENIL');
    expect(r.valida).toBe(true);
  });
  it('rechaza una categoría declarada distinta de la calculada en formaciones por mayor', () => {
    const r = validarFicha(P, evento, ficha({ categoriaDeclarada: 'ADULTO' }));
    expect(r.infracciones).toContainEqual({ codigo: 'CATEGORIA_NO_COINCIDE', params: { declarada: 'ADULTO', calculada: 'INFANTO_JUVENIL' } });
  });
  it('controla cantidad de integrantes y duplicados', () => {
    const r = validarFicha(P, evento, ficha({ formacion: 'TRIO', integrantes: [...integrantes([12, 13]), { bailarinId: 'b1', fechaNacimiento: nacidoCon(12) }, ...integrantes([14])] }));
    const codigos = r.infracciones.map((i) => i.codigo);
    expect(codigos).toContain('INTEGRANTES_EXCEDIDOS');
    expect(codigos).toContain('INTEGRANTE_DUPLICADO');
    expect(validarFicha(P, evento, ficha({ formacion: 'GRUPO', integrantes: integrantes([20, 20]), categoriaDeclarada: 'ADULTO' })).infracciones.map((i) => i.codigo)).toContain('INTEGRANTES_INSUFICIENTES');
  });
  it('informa integrantes sin categoría, formación, género y categoría desconocidos', () => {
    expect(validarFicha(P, evento, ficha({ integrantes: integrantes([1]) })).infracciones.map((i) => i.codigo)).toContain('INTEGRANTE_SIN_CATEGORIA');
    const r = validarFicha(P, evento, ficha({ formacion: 'X', genero: 'Y' }));
    expect(r.infracciones.map((i) => i.codigo)).toEqual(expect.arrayContaining(['FORMACION_DESCONOCIDA', 'GENERO_DESCONOCIDO']));
    expect(validarFicha(P, evento, ficha({ formacion: 'GRUPO', categoriaDeclarada: 'Z', integrantes: integrantes([20, 20, 20, 20]) })).infracciones.map((i) => i.codigo)).toContain('CATEGORIA_DESCONOCIDA');
  });
  it('una ficha sin elenco todavía no tiene categoría ni infracciones de categoría', () => {
    const r = validarFicha(P, evento, ficha({ integrantes: [] }));
    expect(r.categoria).toBeNull();
    expect(r.infracciones.map((i) => i.codigo)).toEqual(['INTEGRANTES_INSUFICIENTES']);
  });
  it('un solista sin categoría por edad no tiene categoría', () => {
    expect(validarFicha(P, evento, ficha({ integrantes: integrantes([2]) })).categoria).toBeNull();
  });
});

describe('[TR-01] [SA-16] coherencia del reglamento', () => {
  it('detecta superposiciones, duplicados y referencias inexistentes', () => {
    const malo: ReglamentoEvento = {
      ...P,
      categorias: [
        { codigo: 'A', nombre: {}, edadMin: 5, edadMax: 10, orden: 1 },
        { codigo: 'A', nombre: {}, edadMin: 9, edadMax: 8, orden: 2 },
      ],
      formaciones: [{ codigo: 'SOLO', nombre: {}, integrantesMin: 0, integrantesMax: 1, toleranciaTiempoSeg: 15, criterioCategoria: 'MAYOR' }],
      generos: [{ codigo: 'G', nombre: {}, desdeCategoria: 'NO_EXISTE' }],
      tiempos: [{ formacion: 'NO', maxSegundos: 0 }],
      toleranciaGrupo: { ...P.toleranciaGrupo, porcentaje: 120 },
      bandas: [
        { codigo: 'B1', nombre: {}, umbral: 7 },
        { codigo: 'B2', nombre: {}, umbral: 8 },
        { codigo: 'B3', nombre: {}, umbral: 11 },
      ],
      puntaje: { ...P.puntaje, escalaMin: 10, escalaMax: 10 },
    };
    const codigos = validarReglamento(malo).map((e) => e.codigo);
    expect(codigos).toEqual(
      expect.arrayContaining([
        'CODIGO_DUPLICADO',
        'RANGO_EDAD_INVALIDO',
        'CATEGORIAS_SUPERPUESTAS',
        'REFERENCIA_INEXISTENTE',
        'TIEMPO_INVALIDO',
        'INTEGRANTES_INVALIDOS',
        'TOLERANCIA_INVALIDA',
        'BANDAS_NO_ORDENADAS',
        'ESCALA_INVALIDA',
        'UMBRAL_FUERA_DE_ESCALA',
      ]),
    );
  });
  it('exige al menos una categoría, formación y género', () => {
    const vacio: ReglamentoEvento = { ...P, categorias: [], formaciones: [], generos: [], tiempos: [] };
    expect(validarReglamento(vacio).map((e) => e.codigo)).toEqual(['SIN_CATEGORIAS', 'SIN_FORMACIONES', 'SIN_GENEROS']);
  });
  it('detecta una categoría abierta seguida de otra', () => {
    const r: ReglamentoEvento = {
      ...P,
      categorias: [
        { codigo: 'A', nombre: {}, edadMin: 5, edadMax: null, orden: 1 },
        { codigo: 'B', nombre: {}, edadMin: 20, edadMax: null, orden: 2 },
      ],
      generos: [{ codigo: 'G', nombre: {} }],
      tiempos: [],
    };
    expect(validarReglamento(r).map((e) => e.codigo)).toEqual(['CATEGORIAS_SUPERPUESTAS']);
  });
});
