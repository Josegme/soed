import type { FechaISO } from '../shared/fecha';
import { buscarCategoria, edadYCategoria } from './categoria';
import { infraccion, type Infraccion } from './infracciones';
import { evaluarDuracion, tiempoMaximo } from './tiempo';
import { evaluarGrupoEnCategoria, sugerirCategoriasGrupo } from './tolerancia-grupo';
import type { FechasEvento, Formacion, Genero, ReglamentoEvento } from './tipos';

export interface IntegranteFicha {
  readonly bailarinId: string;
  readonly fechaNacimiento: FechaISO;
}

export interface FichaAValidar {
  readonly formacion: string;
  readonly genero: string;
  /** Categoría elegida por la academia (obligatoria solo si el grupo admite varias). */
  readonly categoriaDeclarada?: string | null;
  readonly integrantes: readonly IntegranteFicha[];
  readonly duracionMusicaSegundos?: number | null;
}

export interface IntegranteValidado {
  readonly bailarinId: string;
  readonly edad: number;
  readonly categoria: string | null;
}

export interface ResultadoValidacion {
  /** Categoría con la que compite la ficha, o null si no se pudo determinar. */
  readonly categoria: string | null;
  readonly categoriasSugeridas: readonly string[];
  readonly integrantes: readonly IntegranteValidado[];
  /** Impiden enviar la ficha (salvo excepción registrada por el organizador). */
  readonly infracciones: readonly Infraccion[];
  /** Informativas: no impiden enviar. */
  readonly advertencias: readonly Infraccion[];
  readonly tiempoMaximoSegundos: number | null;
  readonly toleranciaSegundos: number;
  readonly valida: boolean;
}

function categoriaPorMayor(integrantes: readonly IntegranteValidado[]): IntegranteValidado | undefined {
  return integrantes.reduce<IntegranteValidado | undefined>(
    (mayor, i) => (mayor === undefined || i.edad > mayor.edad ? i : mayor),
    undefined,
  );
}

function generoHabilitado(reglamento: ReglamentoEvento, genero: Genero, categoria: string): boolean {
  const orden = (codigo: string): number => buscarCategoria(reglamento, codigo)?.orden ?? Number.NaN;
  const actual = orden(categoria);
  if (genero.categoriasHabilitadas && genero.categoriasHabilitadas.length > 0) {
    if (!genero.categoriasHabilitadas.includes(categoria)) return false;
  }
  if (genero.desdeCategoria !== undefined && !(actual >= orden(genero.desdeCategoria))) return false;
  if (genero.hastaCategoria !== undefined && !(actual <= orden(genero.hastaCategoria))) return false;
  return true;
}

function validarIntegrantes(formacion: Formacion, ficha: FichaAValidar): Infraccion[] {
  const infracciones: Infraccion[] = [];
  const n = ficha.integrantes.length;
  if (n < formacion.integrantesMin) {
    infracciones.push(infraccion('INTEGRANTES_INSUFICIENTES', { cantidad: n, minimo: formacion.integrantesMin }));
  }
  if (formacion.integrantesMax !== null && n > formacion.integrantesMax) {
    infracciones.push(infraccion('INTEGRANTES_EXCEDIDOS', { cantidad: n, maximo: formacion.integrantesMax }));
  }
  const vistos = new Set<string>();
  for (const i of ficha.integrantes) {
    if (vistos.has(i.bailarinId)) {
      infracciones.push(infraccion('INTEGRANTE_DUPLICADO', { bailarinId: i.bailarinId }));
    }
    vistos.add(i.bailarinId);
  }
  return infracciones;
}

interface CategoriaResuelta {
  readonly categoria: string | null;
  readonly sugeridas: readonly string[];
  readonly infracciones: readonly Infraccion[];
}

function resolverCategoria(
  reglamento: ReglamentoEvento,
  formacion: Formacion,
  ficha: FichaAValidar,
  integrantes: readonly IntegranteValidado[],
): CategoriaResuelta {
  const declarada = ficha.categoriaDeclarada ?? null;
  if (declarada !== null && !buscarCategoria(reglamento, declarada)) {
    return { categoria: null, sugeridas: [], infracciones: [infraccion('CATEGORIA_DESCONOCIDA', { categoria: declarada })] };
  }
  if (integrantes.length === 0) return { categoria: declarada, sugeridas: [], infracciones: [] };

  if (formacion.criterioCategoria === 'MAYOR') {
    const mayor = categoriaPorMayor(integrantes);
    const calculada = mayor?.categoria ?? null;
    if (calculada === null) return { categoria: null, sugeridas: [], infracciones: [] };
    if (declarada !== null && declarada !== calculada) {
      return {
        categoria: calculada,
        sugeridas: [calculada],
        infracciones: [infraccion('CATEGORIA_NO_COINCIDE', { declarada, calculada })],
      };
    }
    return { categoria: calculada, sugeridas: [calculada], infracciones: [] };
  }

  const sugeridas = sugerirCategoriasGrupo(reglamento, integrantes).map((s) => s.categoria);
  if (declarada !== null) {
    return {
      categoria: declarada,
      sugeridas,
      infracciones: evaluarGrupoEnCategoria(reglamento, declarada, integrantes),
    };
  }
  if (sugeridas.length === 1) return { categoria: sugeridas[0] ?? null, sugeridas, infracciones: [] };
  return {
    categoria: null,
    sugeridas,
    infracciones: [infraccion('CATEGORIA_NO_DETERMINADA', { candidatas: sugeridas.join(',') })],
  };
}

/**
 * Valida una ficha contra el reglamento del evento (PR-12): integrantes,
 * categoría por edad a la fecha de referencia, tolerancia de grupo, género
 * habilitado y duración de la música. Función pura: no consulta estado externo.
 */
export function validarFicha(
  reglamento: ReglamentoEvento,
  evento: FechasEvento,
  ficha: FichaAValidar,
): ResultadoValidacion {
  const infracciones: Infraccion[] = [];
  const advertencias: Infraccion[] = [];

  const integrantes: IntegranteValidado[] = ficha.integrantes.map((i) => {
    const { edad, categoria } = edadYCategoria(reglamento, evento, i.fechaNacimiento);
    return { bailarinId: i.bailarinId, edad, categoria: categoria?.codigo ?? null };
  });
  for (const i of integrantes) {
    if (i.categoria === null) {
      infracciones.push(infraccion('INTEGRANTE_SIN_CATEGORIA', { bailarinId: i.bailarinId, edad: i.edad }));
    }
  }

  const formacion = reglamento.formaciones.find((f) => f.codigo === ficha.formacion);
  const genero = reglamento.generos.find((g) => g.codigo === ficha.genero);
  if (!formacion) infracciones.push(infraccion('FORMACION_DESCONOCIDA', { formacion: ficha.formacion }));
  if (!genero) infracciones.push(infraccion('GENERO_DESCONOCIDO', { genero: ficha.genero }));

  let categoria: string | null = null;
  let sugeridas: readonly string[] = [];
  let maxSegundos: number | null = null;
  const toleranciaSegundos = formacion?.toleranciaTiempoSeg ?? 0;

  if (formacion) {
    infracciones.push(...validarIntegrantes(formacion, ficha));
    const resuelta = resolverCategoria(reglamento, formacion, ficha, integrantes);
    categoria = resuelta.categoria;
    sugeridas = resuelta.sugeridas;
    infracciones.push(...resuelta.infracciones);
  }

  if (genero && categoria !== null && !generoHabilitado(reglamento, genero, categoria)) {
    infracciones.push(infraccion('GENERO_NO_HABILITADO_EN_CATEGORIA', { genero: genero.codigo, categoria }));
  }

  if (formacion && genero) {
    maxSegundos = tiempoMaximo(reglamento, { genero: genero.codigo, formacion: formacion.codigo, categoria });
    if (maxSegundos === null) advertencias.push(infraccion('SIN_TIEMPO_MAXIMO'));
  }

  const duracion = ficha.duracionMusicaSegundos ?? null;
  if (duracion === null) {
    advertencias.push(infraccion('MUSICA_FALTANTE'));
  } else if (maxSegundos !== null) {
    const evaluacion = evaluarDuracion(duracion, maxSegundos, toleranciaSegundos);
    const params = { duracion, maximo: maxSegundos, tolerancia: toleranciaSegundos };
    if (evaluacion === 'EXCEDIDA') infracciones.push(infraccion('DURACION_EXCEDIDA', params));
    if (evaluacion === 'EN_TOLERANCIA') advertencias.push(infraccion('DURACION_EN_TOLERANCIA', params));
  }

  return {
    categoria,
    categoriasSugeridas: sugeridas,
    integrantes,
    infracciones,
    advertencias,
    tiempoMaximoSegundos: maxSegundos,
    toleranciaSegundos,
    valida: infracciones.length === 0,
  };
}
