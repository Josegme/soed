import { describe, expect, it } from 'vitest';
import { rutaInternaSegura } from './rutas';

describe('[TR-35] retorno seguro tras el login', () => {
  it('acepta rutas internas con query', () => {
    expect(rutaInternaSegura('/academia/invitacion/abc123')).toBe('/academia/invitacion/abc123');
    expect(rutaInternaSegura('/jurado/1?ficha=2')).toBe('/jurado/1?ficha=2');
  });
  it('rechaza redirecciones abiertas y valores raros', () => {
    for (const malo of ['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', '', null, '/a b', `/${'x'.repeat(400)}`]) {
      expect(rutaInternaSegura(malo)).toBeNull();
    }
  });
});
