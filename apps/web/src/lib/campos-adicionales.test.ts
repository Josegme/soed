import { validarCamposAdicionales, type CampoAdicional } from '@soed/domain';
import { describe, expect, it } from 'vitest';
import { valoresCamposAdicionales } from './campos-adicionales';

const campos: CampoAdicional[] = [
  { codigo: 'talle', etiqueta: { es: 'Talle' }, tipo: 'OPCION', obligatorio: true, opciones: ['S', 'M'] },
  { codigo: 'peso', etiqueta: { es: 'Peso' }, tipo: 'NUMERO', obligatorio: false },
  { codigo: 'foto', etiqueta: { es: 'Autoriza foto' }, tipo: 'BOOLEANO', obligatorio: false },
  { codigo: 'nota', etiqueta: { es: 'Nota' }, tipo: 'TEXTO', obligatorio: false },
];

const formulario = (pares: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(pares)) f.set(k, v);
  return f;
};

describe('[OR-16] [PR-18] valores de campos adicionales', () => {
  it('convierte por tipo y omite lo vacío', () => {
    expect(
      valoresCamposAdicionales(campos, formulario({ 'dato.talle': 'M', 'dato.peso': '42,5', 'dato.foto': 'on', 'dato.nota': '  ' })),
    ).toEqual({
      talle: 'M',
      peso: 42.5,
      foto: true,
    });
  });

  it('con el dominio detecta obligatorios faltantes y opciones inválidas', () => {
    const faltante = validarCamposAdicionales(campos, valoresCamposAdicionales(campos, formulario({})));
    expect(faltante.map((e) => e.codigo)).toEqual(['CAMPO_OBLIGATORIO']);
    const invalida = validarCamposAdicionales(
      campos,
      valoresCamposAdicionales(campos, formulario({ 'dato.talle': 'XL', 'dato.peso': 'abc' })),
    );
    expect(invalida.map((e) => e.codigo)).toEqual(['OPCION_INVALIDA', 'TIPO_INVALIDO']);
  });
});
