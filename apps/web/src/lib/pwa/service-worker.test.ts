import { describe, expect, it } from 'vitest';
import { codigoServiceWorker } from './service-worker';

describe('[PU-14] service worker', () => {
  const codigo = codigoServiceWorker('abc', { '/es': '/es/sin-conexion', '/pt': '/pt/sin-conexion' });

  it('precachea solo las páginas sin conexión de cada idioma, versionadas', () => {
    expect(codigo).toContain('"soed-shell-abc"');
    expect(codigo).toContain('{"/es":"/es/sin-conexion","/pt":"/pt/sin-conexion"}');
  });

  it('no cachea navegación, API ni otros orígenes: solo estáticos con hash', () => {
    expect(codigo).toContain("request.mode === 'navigate'");
    expect(codigo).toContain("url.pathname.startsWith('/_next/static/')");
    expect(codigo).toContain('url.origin !== self.location.origin');
    expect(codigo).not.toMatch(/\/api\//);
  });

  it('es JavaScript válido', () => {
    expect(() => new Function(codigo)).not.toThrow();
  });
});
