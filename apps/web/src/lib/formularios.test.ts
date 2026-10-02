import { describe, expect, it } from 'vitest';
import { parsearMonto, traducibleDe, traduciblesDe } from './formularios';

describe('[TR-17] montos ingresados a centavos', () => {
  it('acepta coma o punto decimal y hasta dos decimales', () => {
    expect(parsearMonto('150')).toBe(15000);
    expect(parsearMonto('150,5')).toBe(15050);
    expect(parsearMonto('150.55')).toBe(15055);
    expect(parsearMonto(' 0,99 ')).toBe(99);
  });
  it('rechaza separadores de miles, negativos y texto', () => {
    expect(parsearMonto('1.500,50')).toBeNull();
    expect(parsearMonto('-10')).toBeNull();
    expect(parsearMonto('diez')).toBeNull();
    expect(parsearMonto('10,555')).toBeNull();
    expect(parsearMonto('')).toBeNull();
  });
});

describe('[TR-21] textos traducibles desde formularios (un campo por idioma)', () => {
  it('arma el traducible con los idiomas completados', () => {
    const d = new FormData();
    d.set('nombre.es', ' Pista principal ');
    d.set('nombre.pt-BR', '');
    expect(traducibleDe(d, 'nombre')).toEqual({ es: 'Pista principal' });
  });
  it('alinea listas repetidas por posición', () => {
    const d = new FormData();
    d.append('rubro.es', 'Remera');
    d.append('rubro.pt-BR', 'Camiseta');
    d.append('rubro.es', '');
    d.append('rubro.pt-BR', 'Boné');
    expect(traduciblesDe(d, 'rubro')).toEqual([{ es: 'Remera', 'pt-BR': 'Camiseta' }, { 'pt-BR': 'Boné' }]);
  });
});
