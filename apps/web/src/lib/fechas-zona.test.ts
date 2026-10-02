import { describe, expect, it } from 'vitest';
import { instanteDesdeLocal, localDesdeInstante } from './fechas-zona';

describe('[TR-23] horarios en la zona de la sede', () => {
  it('convierte la hora local de São Paulo y Buenos Aires (UTC−3) a UTC', () => {
    expect(instanteDesdeLocal('2026-11-01T10:00', 'America/Sao_Paulo')).toBe('2026-11-01T13:00:00.000Z');
    expect(instanteDesdeLocal('2026-11-01T10:00', 'America/Argentina/Buenos_Aires')).toBe('2026-11-01T13:00:00.000Z');
  });
  it('respeta el horario de verano de la zona', () => {
    expect(instanteDesdeLocal('2026-07-01T09:30', 'America/New_York')).toBe('2026-07-01T13:30:00.000Z');
    expect(instanteDesdeLocal('2026-01-15T09:30', 'America/New_York')).toBe('2026-01-15T14:30:00.000Z');
  });
  it('ida y vuelta estable y entradas inválidas', () => {
    expect(localDesdeInstante('2026-11-01T13:00:00.000Z', 'America/Sao_Paulo')).toBe('2026-11-01T10:00');
    expect(localDesdeInstante(null, 'America/Sao_Paulo')).toBe('');
    expect(instanteDesdeLocal('01/11/2026 10:00', 'America/Sao_Paulo')).toBeNull();
  });
});
