import { traducir, type Idioma, type ReglamentoEvento, type Traducible } from '@soed/domain';

/** Texto de contenido del organizador en el idioma pedido, con fallback (TR-21). */
export function texto(valor: unknown, idioma: Idioma, defecto: Idioma = 'es'): string {
  return traducir((valor ?? {}) as Traducible, idioma, defecto).texto;
}

/** Nombre visible de un código del reglamento (categoría, formación o género). */
export function nombreCodigo(
  reglamento: ReglamentoEvento | null | undefined,
  lista: 'categorias' | 'formaciones' | 'generos',
  codigo: string | null | undefined,
  idioma: Idioma,
): string {
  if (!codigo) return '';
  const item = reglamento?.[lista]?.find((x) => x.codigo === codigo);
  return item ? texto(item.nombre, idioma) || codigo : codigo;
}
