import type { ReglaTiempo, ReglamentoEvento } from './tipos';

export interface ClaveTiempo {
  readonly genero: string;
  readonly formacion: string;
  readonly categoria: string | null;
}

function especificidad(regla: ReglaTiempo): number {
  return (regla.genero ? 1 : 0) + (regla.formacion ? 1 : 0) + (regla.categoria ? 1 : 0);
}

function aplica(regla: ReglaTiempo, clave: ClaveTiempo): boolean {
  return (
    (!regla.genero || regla.genero === clave.genero) &&
    (!regla.formacion || regla.formacion === clave.formacion) &&
    (!regla.categoria || regla.categoria === clave.categoria)
  );
}

/**
 * Tiempo máximo en segundos para una combinación de género, formación y
 * categoría (TR-05). Gana la regla más específica; ante empate de
 * especificidad, la más estricta. null si ninguna regla aplica.
 */
export function tiempoMaximo(reglamento: ReglamentoEvento, clave: ClaveTiempo): number | null {
  let mejor: ReglaTiempo | null = null;
  for (const regla of reglamento.tiempos) {
    if (!aplica(regla, clave)) continue;
    if (
      mejor === null ||
      especificidad(regla) > especificidad(mejor) ||
      (especificidad(regla) === especificidad(mejor) && regla.maxSegundos < mejor.maxSegundos)
    ) {
      mejor = regla;
    }
  }
  return mejor?.maxSegundos ?? null;
}

export type EvaluacionDuracion = 'DENTRO' | 'EN_TOLERANCIA' | 'EXCEDIDA';

/** Evalúa la duración de la música contra el máximo y la tolerancia de la formación (TR-04). */
export function evaluarDuracion(
  duracionSegundos: number,
  maxSegundos: number,
  toleranciaSegundos: number,
): EvaluacionDuracion {
  if (duracionSegundos <= maxSegundos) return 'DENTRO';
  if (duracionSegundos <= maxSegundos + toleranciaSegundos) return 'EN_TOLERANCIA';
  return 'EXCEDIDA';
}
