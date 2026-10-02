import { describe, expect, it } from 'vitest';
import { normalizarValidacion } from './consultas';

describe('[PR-12] validación guardada en jsonb', () => {
  it('completa los arrays faltantes de una validación parcial', () => {
    expect(normalizarValidacion({ valida: true })).toMatchObject({ valida: true, infracciones: [], advertencias: [], integrantes: [] });
    expect(normalizarValidacion(null)).toBeNull();
    expect(normalizarValidacion({ valida: 'si' })?.valida).toBe(false);
  });
});
