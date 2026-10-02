import { describe, expect, it } from 'vitest';
import { codigoDeError, intentar } from './acciones';

describe('[TR-31] errores de escritura a códigos de interfaz', () => {
  it('propaga los códigos de los triggers y mapea RLS y duplicados', () => {
    expect(codigoDeError({ message: 'COBRO_YA_ANULADO', code: 'P0001' })).toBe('COBRO_YA_ANULADO');
    expect(codigoDeError(new Error('MONEDA_DISTINTA'))).toBe('MONEDA_DISTINTA');
    expect(codigoDeError({ message: 'new row violates row-level security policy for table "cobro"', code: '42501' })).toBe('SIN_PERMISO');
    expect(codigoDeError({ message: 'duplicate key value', code: '23505' })).toBe('DUPLICADO');
    expect(codigoDeError(new Error('fetch failed: ECONNREFUSED 10.0.0.1'))).toBe('INESPERADO');
  });
  it('intentar devuelve un estado de formulario en lugar de lanzar', async () => {
    expect(
      await intentar(async () => {
        throw new Error('SIN_PERMISO');
      }),
    ).toEqual({ ok: false, mensaje: 'SIN_PERMISO', valores: undefined });
  });
});
