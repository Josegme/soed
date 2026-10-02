import type { ReglamentoEvento } from '../tipos';
import { PRESET_ENCUENTRO_2026 } from './encuentro-2026';

/**
 * Presets de reglamento disponibles (SA-07). Un preset nuevo es un archivo
 * más en esta carpeta y una entrada aquí; ninguna pantalla cambia.
 */
export const PRESETS_REGLAMENTO: Readonly<Record<string, ReglamentoEvento>> = {
  [PRESET_ENCUENTRO_2026.preset ?? 'encuentro-2026']: PRESET_ENCUENTRO_2026,
};

export function presetReglamento(codigo: string | null | undefined): ReglamentoEvento | null {
  return (codigo && PRESETS_REGLAMENTO[codigo]) || null;
}
