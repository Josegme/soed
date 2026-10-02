import { describe, expect, it } from 'vitest';
import { contenidoEmail, TIPOS_NOTIFICACION } from './contenido';

const t = (clave: string, v?: Record<string, string | number>) =>
  v && Object.keys(v).length ? `${clave}(${Object.values(v).join('|')})` : clave;

describe('[PR-22] [TR-22] contenido de emails transaccionales', () => {
  it('compone asunto, cuerpo, detalle y acción con los datos interpolados', () => {
    const c = contenidoEmail(
      'cobro_registrado',
      { evento: 'Selectivo A', numero: 'LIQ-SELA-0001', monto: 'R$ 40,00', saldo: 'R$ 60,00' },
      t,
      'https://x/es/academia',
    );
    expect(c.asunto).toBe('cobro_registrado.asunto(Selectivo A|LIQ-SELA-0001|R$ 40,00|R$ 60,00)');
    expect(c.detalle).toEqual([
      { etiqueta: 'detalle.numero', valor: 'LIQ-SELA-0001' },
      { etiqueta: 'detalle.monto', valor: 'R$ 40,00' },
      { etiqueta: 'detalle.saldo', valor: 'R$ 60,00' },
    ]);
    expect(c.accion).toEqual({ texto: 'cobro_registrado.accion', url: 'https://x/es/academia' });
  });
  it('omite el detalle cuando el tipo no lo usa o faltan datos', () => {
    expect(contenidoEmail('orden_publicado', { evento: 'X' }, t, 'u').detalle).toBeUndefined();
    expect(contenidoEmail('liquidacion_emitida', {}, t, 'u').detalle).toBeUndefined();
  });
  it('cubre todos los tipos declarados', () => {
    for (const tipo of TIPOS_NOTIFICACION) expect(contenidoEmail(tipo, {}, t, 'u').titulo).toBe(`${tipo}.titulo`);
  });
});
