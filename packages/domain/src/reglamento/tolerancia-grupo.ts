import { distanciaCategorias, categoriasOrdenadas } from './categoria';
import { infraccion, type Infraccion } from './infracciones';
import type { ReglamentoEvento, ToleranciaGrupo } from './tipos';

/** Cantidad máxima de integrantes fuera de categoría para un grupo de n integrantes (TR-03). */
export function maximoFueraDeCategoria(n: number, tolerancia: ToleranciaGrupo): number {
  const bruto = (n * tolerancia.porcentaje) / 100;
  switch (tolerancia.redondeo) {
    case 'FLOOR':
      return Math.floor(bruto + 1e-9);
    case 'CEIL':
      return Math.ceil(bruto - 1e-9);
    case 'ROUND':
      return Math.round(bruto);
  }
}

export interface IntegranteCategorizado {
  readonly bailarinId: string;
  readonly categoria: string | null;
}

/**
 * Infracciones de un grupo que compite en `categoria`. Los integrantes sin
 * categoría cuentan como fuera de categoría.
 */
export function evaluarGrupoEnCategoria(
  reglamento: ReglamentoEvento,
  categoria: string,
  integrantes: readonly IntegranteCategorizado[],
): Infraccion[] {
  const tolerancia = reglamento.toleranciaGrupo;
  const infracciones: Infraccion[] = [];
  const fuera = integrantes.filter((i) => i.categoria !== categoria);

  for (const integrante of fuera) {
    if (integrante.categoria === null) continue;
    const distancia = distanciaCategorias(reglamento, integrante.categoria, categoria);
    if (
      (tolerancia.direccion === 'SOLO_MENORES' && distancia > 0) ||
      (tolerancia.direccion === 'SOLO_MAYORES' && distancia < 0)
    ) {
      infracciones.push(
        infraccion('INTEGRANTE_FUERA_DE_DIRECCION', {
          bailarinId: integrante.bailarinId,
          categoria: integrante.categoria,
        }),
      );
    }
    if (tolerancia.soloAdyacentes && Math.abs(distancia) > 1) {
      infracciones.push(
        infraccion('INTEGRANTE_CATEGORIA_NO_ADYACENTE', {
          bailarinId: integrante.bailarinId,
          categoria: integrante.categoria,
        }),
      );
    }
  }

  const maximo = maximoFueraDeCategoria(integrantes.length, tolerancia);
  if (fuera.length > maximo) {
    infracciones.push(
      infraccion('TOLERANCIA_GRUPO_EXCEDIDA', {
        fueraDeCategoria: fuera.length,
        maximoPermitido: maximo,
        porcentaje: tolerancia.porcentaje,
      }),
    );
  }
  return infracciones;
}

export interface CategoriaSugerida {
  readonly categoria: string;
  readonly dentroDeCategoria: number;
}

/**
 * Categorías en las que el grupo cumple la tolerancia, de mayor a menor cantidad
 * de integrantes dentro de la categoría. Con tolerancia menor al 50 % hay a lo
 * sumo una.
 */
export function sugerirCategoriasGrupo(
  reglamento: ReglamentoEvento,
  integrantes: readonly IntegranteCategorizado[],
): CategoriaSugerida[] {
  return categoriasOrdenadas(reglamento)
    .filter((c) => evaluarGrupoEnCategoria(reglamento, c.codigo, integrantes).length === 0)
    .map((c) => ({
      categoria: c.codigo,
      dentroDeCategoria: integrantes.filter((i) => i.categoria === c.codigo).length,
    }))
    .sort((a, b) => b.dentroDeCategoria - a.dentroDeCategoria);
}
