import { errorDominio, type ErrorDominio } from '../shared/result';
import type { ReglamentoEvento } from './tipos';

export type CodigoErrorReglamento =
  | 'SIN_CATEGORIAS'
  | 'SIN_FORMACIONES'
  | 'SIN_GENEROS'
  | 'CODIGO_DUPLICADO'
  | 'RANGO_EDAD_INVALIDO'
  | 'CATEGORIAS_SUPERPUESTAS'
  | 'REFERENCIA_INEXISTENTE'
  | 'INTEGRANTES_INVALIDOS'
  | 'TOLERANCIA_INVALIDA'
  | 'TIEMPO_INVALIDO'
  | 'BANDAS_NO_ORDENADAS'
  | 'ESCALA_INVALIDA'
  | 'UMBRAL_FUERA_DE_ESCALA';

export type ErrorReglamento = ErrorDominio<CodigoErrorReglamento>;

function duplicados(codigos: readonly string[]): string[] {
  return codigos.filter((c, i) => codigos.indexOf(c) !== i);
}

/**
 * Verifica la coherencia interna de un reglamento antes de guardarlo (ADR-0006).
 * Devuelve la lista de errores; vacía si es válido.
 */
export function validarReglamento(r: ReglamentoEvento): ErrorReglamento[] {
  const errores: ErrorReglamento[] = [];
  if (r.categorias.length === 0) errores.push(errorDominio('SIN_CATEGORIAS'));
  if (r.formaciones.length === 0) errores.push(errorDominio('SIN_FORMACIONES'));
  if (r.generos.length === 0) errores.push(errorDominio('SIN_GENEROS'));

  const listas = {
    categorias: r.categorias.map((c) => c.codigo),
    formaciones: r.formaciones.map((f) => f.codigo),
    generos: r.generos.map((g) => g.codigo),
    bandas: r.bandas.map((b) => b.codigo),
  };
  for (const [lista, codigos] of Object.entries(listas)) {
    for (const codigo of new Set(duplicados(codigos))) {
      errores.push(errorDominio('CODIGO_DUPLICADO', { lista, codigo }));
    }
  }

  const categorias = [...r.categorias].sort((a, b) => a.orden - b.orden);
  for (const c of categorias) {
    if (c.edadMin < 0 || (c.edadMax !== null && c.edadMax < c.edadMin)) {
      errores.push(errorDominio('RANGO_EDAD_INVALIDO', { categoria: c.codigo }));
    }
  }
  for (let i = 1; i < categorias.length; i++) {
    const anterior = categorias[i - 1];
    const actual = categorias[i];
    if (anterior && actual && (anterior.edadMax === null || anterior.edadMax >= actual.edadMin)) {
      errores.push(errorDominio('CATEGORIAS_SUPERPUESTAS', { a: anterior.codigo, b: actual.codigo }));
    }
  }

  const existe = (lista: readonly string[], codigo: string | undefined): boolean => codigo === undefined || lista.includes(codigo);
  for (const g of r.generos) {
    for (const ref of [...(g.categoriasHabilitadas ?? []), g.desdeCategoria, g.hastaCategoria]) {
      if (!existe(listas.categorias, ref)) {
        errores.push(errorDominio('REFERENCIA_INEXISTENTE', { en: `genero:${g.codigo}`, codigo: String(ref) }));
      }
    }
  }
  for (const [i, t] of r.tiempos.entries()) {
    const refs: [readonly string[], string | undefined][] = [
      [listas.generos, t.genero],
      [listas.formaciones, t.formacion],
      [listas.categorias, t.categoria],
    ];
    for (const [lista, codigo] of refs) {
      if (!existe(lista, codigo)) {
        errores.push(errorDominio('REFERENCIA_INEXISTENTE', { en: `tiempo:${i}`, codigo: String(codigo) }));
      }
    }
    if (!Number.isInteger(t.maxSegundos) || t.maxSegundos <= 0) {
      errores.push(errorDominio('TIEMPO_INVALIDO', { indice: i }));
    }
  }

  for (const f of r.formaciones) {
    if (
      !Number.isInteger(f.integrantesMin) ||
      f.integrantesMin < 1 ||
      (f.integrantesMax !== null && f.integrantesMax < f.integrantesMin) ||
      f.toleranciaTiempoSeg < 0
    ) {
      errores.push(errorDominio('INTEGRANTES_INVALIDOS', { formacion: f.codigo }));
    }
  }

  if (r.toleranciaGrupo.porcentaje < 0 || r.toleranciaGrupo.porcentaje > 100) {
    errores.push(errorDominio('TOLERANCIA_INVALIDA'));
  }

  const p = r.puntaje;
  if (p.escalaMin >= p.escalaMax || p.decimalesNota < 0 || p.decimalesResultado < 0 || p.umbralDesvio < 0) {
    errores.push(errorDominio('ESCALA_INVALIDA'));
  }
  for (let i = 1; i < r.bandas.length; i++) {
    const anterior = r.bandas[i - 1];
    const actual = r.bandas[i];
    if (anterior && actual && anterior.umbral <= actual.umbral) {
      errores.push(errorDominio('BANDAS_NO_ORDENADAS'));
      break;
    }
  }
  for (const b of r.bandas) {
    if (b.umbral < p.escalaMin || b.umbral > p.escalaMax) {
      errores.push(errorDominio('UMBRAL_FUERA_DE_ESCALA', { banda: b.codigo }));
    }
  }
  return errores;
}
