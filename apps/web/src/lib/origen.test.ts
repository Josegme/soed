import { describe, expect, it } from 'vitest';
import { huellaOrigen, ipDeEncabezados } from './origen';

const encabezados = (valores: Record<string, string>) => ({ get: (n: string) => valores[n] ?? null });

describe('[TR-34] origen de solicitudes públicas', () => {
  it('toma el primer valor de x-forwarded-for y prefiere x-real-ip', () => {
    expect(ipDeEncabezados(encabezados({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7');
    expect(ipDeEncabezados(encabezados({ 'x-real-ip': '198.51.100.2', 'x-forwarded-for': '203.0.113.7' }))).toBe('198.51.100.2');
    expect(ipDeEncabezados(encabezados({}))).toBe('desconocido');
  });

  it('seudonimiza la IP: estable con el mismo secreto y distinta con otro', () => {
    const a = huellaOrigen('203.0.113.7', 's1');
    expect(a).toBe(huellaOrigen('203.0.113.7', 's1'));
    expect(a).not.toBe(huellaOrigen('203.0.113.7', 's2'));
    expect(a).not.toContain('203');
    expect(a).toHaveLength(22);
  });
});
