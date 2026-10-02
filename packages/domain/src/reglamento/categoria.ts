import { edadCumplida, fechaISO, partesFecha, type FechaISO } from '../shared/fecha';
import type { Categoria, FechasEvento, ReglamentoEvento } from './tipos';

/** Fecha contra la que se calcula la edad completa (TR-02). */
export function fechaReferencia(reglamento: ReglamentoEvento, evento: FechasEvento): FechaISO {
  const regla = reglamento.fechaReferenciaEdad;
  switch (regla.tipo) {
    case 'INICIO_EVENTO':
      return evento.fechaInicio;
    case 'FIN_EVENTO':
      return evento.fechaFin;
    case 'FIN_DE_ANIO': {
      const partes = partesFecha(evento.fechaInicio);
      if (!partes) throw new Error('Fecha de inicio inválida');
      return fechaISO(`${partes.anio}-12-31`);
    }
    case 'FECHA_FIJA':
      return regla.fecha;
  }
}

export function categoriasOrdenadas(reglamento: ReglamentoEvento): Categoria[] {
  return [...reglamento.categorias].sort((a, b) => a.orden - b.orden);
}

export function buscarCategoria(reglamento: ReglamentoEvento, codigo: string): Categoria | undefined {
  return reglamento.categorias.find((c) => c.codigo === codigo);
}

/** Categoría que corresponde a una edad, o null si ninguna la contiene. */
export function categoriaPorEdad(reglamento: ReglamentoEvento, edad: number): Categoria | null {
  return categoriasOrdenadas(reglamento).find((c) => edad >= c.edadMin && (c.edadMax === null || edad <= c.edadMax)) ?? null;
}

export interface EdadYCategoria {
  readonly edad: number;
  readonly categoria: Categoria | null;
}

export function edadYCategoria(reglamento: ReglamentoEvento, evento: FechasEvento, fechaNacimiento: FechaISO): EdadYCategoria {
  const edad = edadCumplida(fechaNacimiento, fechaReferencia(reglamento, evento));
  return { edad, categoria: categoriaPorEdad(reglamento, edad) };
}

/** Posición relativa de dos categorías por orden de edad (negativo: a es menor). */
export function distanciaCategorias(reglamento: ReglamentoEvento, a: string, b: string): number {
  const orden = categoriasOrdenadas(reglamento).map((c) => c.codigo);
  const ia = orden.indexOf(a);
  const ib = orden.indexOf(b);
  if (ia < 0 || ib < 0) throw new Error(`Categoría desconocida: ${ia < 0 ? a : b}`);
  return ia - ib;
}
