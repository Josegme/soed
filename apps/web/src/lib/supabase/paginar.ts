/**
 * Lectura completa por páginas: PostgREST corta en `max-rows` (1000 en
 * Supabase) y una temporada puede superar ese volumen de fichas o resultados.
 */
export async function leerTodo<T>(
  pagina: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  tamano = 1000,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += tamano) {
    const { data, error } = await pagina(desde, desde + tamano - 1);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < tamano) return filas;
  }
}

/** Parte una lista de ids en lotes para filtros `in` sin exceder el largo de URL. */
export function enLotes<T>(items: readonly T[], tamano = 100): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < items.length; i += tamano) lotes.push(items.slice(i, i + tamano));
  return lotes;
}
