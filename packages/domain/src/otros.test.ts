import { describe, expect, it } from 'vitest';
import { acreditar, puedeAcceder } from './acreditacion/acreditacion';
import { asignarHotel } from './hoteles/hoteles';
import { estadoVentana, puedeCrearFicha, puedeModificarFicha, validarCamposAdicionales } from './inscripciones/inscripciones';
import { ajusteDesdeBeneficio, validarPase } from './pases/pases';
import { fichasEnPuesto, repartirPremio } from './premios/premios';
import { cero, dinero, esMoneda, maximo, multiplicar, repartir, restar, sumar, sumarTodos } from './shared/dinero';
import { compararFechas, edadCumplida, esFechaISO, fechaEnZona, fechaISO, partesFecha } from './shared/fecha';
import { errorDominio, err, ok } from './shared/result';
import { esIdioma, idiomasPendientes, traducir } from './shared/traducible';

describe('fechas', () => {
  it('valida fechas de calendario', () => {
    expect(esFechaISO('2026-02-29')).toBe(false);
    expect(esFechaISO('2028-02-29')).toBe(true);
    expect(esFechaISO('2026-13-01')).toBe(false);
    expect(esFechaISO('26-1-1')).toBe(false);
    expect(partesFecha('2026-04-30')).toEqual({ anio: 2026, mes: 4, dia: 30 });
    expect(() => fechaISO('x')).toThrow();
  });
  it('[TR-02] quien nació un 29/02 cumple años el 01/03 en años no bisiestos', () => {
    expect(edadCumplida(fechaISO('2012-02-29'), fechaISO('2026-02-28'))).toBe(13);
    expect(edadCumplida(fechaISO('2012-02-29'), fechaISO('2026-03-01'))).toBe(14);
    expect(() => edadCumplida('x' as never, fechaISO('2026-01-01'))).toThrow();
  });
  it('[TR-23] obtiene la fecha local de la sede', () => {
    const instante = new Date('2026-05-01T02:30:00Z');
    expect(fechaEnZona(instante, 'America/Sao_Paulo')).toBe('2026-04-30');
    expect(fechaEnZona(instante, 'UTC')).toBe('2026-05-01');
    expect(compararFechas(fechaISO('2026-01-01'), fechaISO('2026-01-02'))).toBe(-1);
    expect(compararFechas(fechaISO('2026-01-02'), fechaISO('2026-01-01'))).toBe(1);
    expect(compararFechas(fechaISO('2026-01-02'), fechaISO('2026-01-02'))).toBe(0);
  });
});

describe('[TR-17] dinero en centavos', () => {
  it('opera sin float y rechaza monedas mezcladas', () => {
    const a = dinero(1050, 'BRL');
    expect(sumar(a, dinero(50, 'BRL')).centavos).toBe(1100);
    expect(restar(a, dinero(50, 'BRL')).centavos).toBe(1000);
    expect(multiplicar(dinero(333, 'ARS'), 1.5).centavos).toBe(500);
    expect(multiplicar(dinero(-333, 'ARS'), 1.5).centavos).toBe(-500);
    expect(multiplicar(dinero(0, 'ARS'), -1).centavos).toBe(0);
    expect(maximo(a, cero('BRL'))).toBe(a);
    expect(maximo(cero('BRL'), a)).toBe(a);
    expect(sumarTodos([a, a], 'BRL').centavos).toBe(2100);
    expect(() => sumar(a, dinero(1, 'USD'))).toThrow();
    expect(() => dinero(1.5, 'USD')).toThrow();
    expect(esMoneda('USD')).toBe(true);
    expect(esMoneda('EUR')).toBe(false);
  });
  it('reparte exacto distribuyendo los centavos sobrantes', () => {
    expect(repartir(dinero(1000, 'USD'), 3).map((d) => d.centavos)).toEqual([334, 333, 333]);
    expect(() => repartir(dinero(1, 'USD'), 0)).toThrow();
  });
});

describe('[TR-21] contenido traducible', () => {
  it('usa el idioma pedido, luego el del evento y luego cualquiera', () => {
    expect(traducir({ es: 'Hola', 'pt-BR': 'Olá' }, 'pt-BR', 'es')).toEqual({ texto: 'Olá', faltante: false });
    expect(traducir({ es: 'Hola' }, 'pt-BR', 'es')).toEqual({ texto: 'Hola', faltante: true });
    expect(traducir({ 'pt-BR': 'Olá' }, 'es', 'es')).toEqual({ texto: 'Olá', faltante: true });
    expect(traducir({}, 'es', 'es')).toEqual({ texto: '', faltante: true });
    expect(idiomasPendientes({ es: 'x', 'pt-BR': ' ' })).toEqual(['pt-BR']);
    expect(esIdioma('pt-BR')).toBe(true);
    expect(esIdioma('en')).toBe(false);
  });
});

describe('result', () => {
  it('construye ok, err y errores con parámetros', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
    expect(err('x')).toEqual({ ok: false, error: 'x' });
    expect(errorDominio('A')).toEqual({ codigo: 'A' });
    expect(errorDominio('A', { n: 1 })).toEqual({ codigo: 'A', params: { n: 1 } });
  });
});

describe('[OR-03] [PR-19] ventana de inscripción', () => {
  const v = {
    apertura: '2025-08-10T00:00:00-03:00',
    cierre: '2026-04-20T23:59:59-03:00',
    cierreModificaciones: '2026-04-25T23:59:59-03:00',
  };
  it('recorre los cuatro estados', () => {
    expect(estadoVentana(v, new Date('2025-08-01T00:00:00Z'))).toBe('NO_ABIERTA');
    expect(estadoVentana(v, new Date('2026-01-01T00:00:00Z'))).toBe('ABIERTA');
    expect(estadoVentana(v, new Date('2026-04-22T00:00:00Z'))).toBe('SOLO_MODIFICACIONES');
    expect(estadoVentana(v, new Date('2026-05-01T00:00:00Z'))).toBe('CERRADA');
    expect(estadoVentana({ apertura: null, cierre: null, cierreModificaciones: null }, new Date())).toBe('NO_ABIERTA');
    expect(estadoVentana({ apertura: v.apertura, cierre: null, cierreModificaciones: null }, new Date('2030-01-01'))).toBe('ABIERTA');
    expect(estadoVentana({ ...v, cierreModificaciones: null }, new Date('2026-04-22T00:00:00Z'))).toBe('CERRADA');
  });
  it('controla cupo y bloqueo', () => {
    const abierto = new Date('2026-01-01T00:00:00Z');
    expect(puedeCrearFicha(v, abierto, { maximo: 10, usadas: 9 })).toEqual({ permitido: true });
    expect(puedeCrearFicha(v, abierto, { maximo: 10, usadas: 10 })).toEqual({ permitido: false, motivo: 'CUPO_AGOTADO' });
    expect(puedeCrearFicha(v, new Date('2026-04-22T00:00:00Z'), { maximo: null, usadas: 0 })).toEqual({
      permitido: false,
      motivo: 'VENTANA_CERRADA',
    });
    expect(puedeModificarFicha(v, new Date('2026-04-22T00:00:00Z'), false)).toBe(true);
    expect(puedeModificarFicha(v, abierto, true)).toBe(false);
    expect(puedeModificarFicha(v, new Date('2026-05-01T00:00:00Z'), false)).toBe(false);
  });
});

describe('[OR-16] [PR-18] campos adicionales', () => {
  it('valida obligatoriedad, tipo y opciones', () => {
    const campos = [
      { codigo: 'talle', etiqueta: { es: 'Talle' }, tipo: 'OPCION' as const, obligatorio: true, opciones: ['S', 'M'] },
      { codigo: 'edad', etiqueta: {}, tipo: 'NUMERO' as const, obligatorio: false },
      { codigo: 'ok', etiqueta: {}, tipo: 'BOOLEANO' as const, obligatorio: false },
      { codigo: 'f', etiqueta: {}, tipo: 'FECHA' as const, obligatorio: false },
      { codigo: 't', etiqueta: {}, tipo: 'TEXTO' as const, obligatorio: true },
      { codigo: 'o2', etiqueta: {}, tipo: 'OPCION' as const, obligatorio: false },
    ];
    expect(validarCamposAdicionales(campos, { talle: 'M', edad: 3, ok: true, f: '2026-01-01', t: 'x' })).toEqual([]);
    const errores = validarCamposAdicionales(campos, { talle: 'XL', edad: 'tres', ok: 'si', f: 'no-fecha', t: ' ', o2: 'z' });
    expect(errores.map((e) => `${e.codigo}:${e.params?.campo}`)).toEqual([
      'OPCION_INVALIDA:talle',
      'TIPO_INVALIDO:edad',
      'TIPO_INVALIDO:ok',
      'TIPO_INVALIDO:f',
      'CAMPO_OBLIGATORIO:t',
      'OPCION_INVALIDA:o2',
    ]);
  });
});

describe('[OR-33] [OR-34] [TR-13] pases manuales', () => {
  it('exige un único destino y motivo', () => {
    expect(validarPase({ coreografiaId: 'c', eventoDestinoId: 'e', motivo: '  2º puesto  ' })).toEqual({
      ok: true,
      value: { coreografiaId: 'c', eventoDestinoId: 'e', motivo: '2º puesto' },
    });
    expect(validarPase({ coreografiaId: 'c', academiaId: 'a', eventoDestinoId: 'e', motivo: 'x x x' })).toMatchObject({
      ok: false,
      error: { codigo: 'DESTINO_AMBIGUO' },
    });
    expect(validarPase({ eventoDestinoId: 'e', motivo: 'x x x' })).toMatchObject({ ok: false, error: { codigo: 'DESTINO_AMBIGUO' } });
    expect(validarPase({ academiaId: 'a', eventoDestinoId: 'e', motivo: 'no' })).toMatchObject({
      ok: false,
      error: { codigo: 'MOTIVO_REQUERIDO' },
    });
  });
  it('valida y traduce beneficios a ajustes de liquidación', () => {
    const base = { academiaId: 'a', eventoDestinoId: 'e', motivo: 'Mejor puntaje' };
    expect(validarPase({ ...base, beneficio: { tipo: 'DESCUENTO_PORCENTAJE', porcentaje: 150 } }).ok).toBe(false);
    expect(validarPase({ ...base, beneficio: { tipo: 'DESCUENTO_MONTO', montoCentavos: 0 } }).ok).toBe(false);
    expect(validarPase({ ...base, beneficio: { tipo: 'BECA' } }).ok).toBe(true);
    expect(ajusteDesdeBeneficio({ tipo: 'BECA' }, 'm')).toEqual({ tipo: 'SIN_CARGO', motivo: 'm' });
    expect(ajusteDesdeBeneficio({ tipo: 'DESCUENTO_PORCENTAJE', porcentaje: 20 }, 'm')).toEqual({
      tipo: 'DESCUENTO_PORCENTAJE',
      porcentaje: 20,
      motivo: 'm',
    });
    expect(ajusteDesdeBeneficio({ tipo: 'DESCUENTO_MONTO', montoCentavos: 500 }, 'm')).toEqual({
      tipo: 'DESCUENTO_MONTO',
      monto: 500,
      motivo: 'm',
    });
  });
});

describe('[OR-43] [SA-09] premios', () => {
  it('el empate divide el monto', () => {
    const r = repartirPremio(['a', 'b', 'c'], dinero(300000, 'BRL'), 'DIVIDIR_MONTO');
    expect(r.map((x) => x.monto?.centavos)).toEqual([100000, 100000, 100000]);
  });
  it('admite monto completo para cada uno, premios sin monto y lista vacía', () => {
    expect(repartirPremio(['a', 'b'], dinero(100, 'BRL'), 'MONTO_COMPLETO_CADA_UNO').map((x) => x.monto?.centavos)).toEqual([100, 100]);
    expect(repartirPremio(['a'], null, 'DIVIDIR_MONTO')).toEqual([{ fichaId: 'a', monto: null }]);
    expect(repartirPremio([], dinero(1, 'BRL'), 'DIVIDIR_MONTO')).toEqual([]);
  });
  it('obtiene las fichas en un puesto', () => {
    const puestos = [
      { fichaId: 'a', grupo: 'G1', puesto: 1 },
      { fichaId: 'b', grupo: 'G1', puesto: 1 },
      { fichaId: 'c', grupo: 'G2', puesto: 1 },
    ];
    expect(fichasEnPuesto(puestos, 1, 'G1')).toEqual(['a', 'b']);
    expect(fichasEnPuesto(puestos, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('[OR-54] asignación de hotel', () => {
  const s = [
    { inscripcionId: 'i1', inscriptaAt: '2025-08-10T10:00:00Z', primerPagoAt: null, plazas: 10 },
    { inscripcionId: 'i2', inscriptaAt: '2025-08-11T10:00:00Z', primerPagoAt: '2025-08-12T10:00:00Z', plazas: 5 },
    { inscripcionId: 'i3', inscriptaAt: '2025-08-12T10:00:00Z', primerPagoAt: '2025-08-12T09:00:00Z', plazas: 8 },
    { inscripcionId: 'i4', inscriptaAt: '2025-08-12T10:00:00Z', primerPagoAt: null, plazas: 1 },
  ];
  it('prioriza por primer pago y deja el resto en espera', () => {
    expect(asignarHotel(s, 10, 'PRIMER_PAGO')).toEqual([
      { inscripcionId: 'i3', plazasAsignadas: 8, enEspera: 0, prioridad: 1 },
      { inscripcionId: 'i2', plazasAsignadas: 2, enEspera: 3, prioridad: 2 },
      { inscripcionId: 'i1', plazasAsignadas: 0, enEspera: 10, prioridad: 3 },
      { inscripcionId: 'i4', plazasAsignadas: 0, enEspera: 1, prioridad: 4 },
    ]);
  });
  it('puede priorizar solo por orden de inscripción', () => {
    expect(asignarHotel(s, 12, 'INSCRIPCION').map((a) => a.inscripcionId)).toEqual(['i1', 'i2', 'i3', 'i4']);
    expect(asignarHotel([s[3]!, { ...s[3]!, inscripcionId: 'i0' }], 0, 'PRIMER_PAGO').map((a) => a.inscripcionId)).toEqual(['i0', 'i4']);
  });
});

describe('[OP-17] [OP-24] [OP-25] acreditación', () => {
  const c = { id: 'c1', zonas: ['CAMARINES'], acreditadoAt: null, anulada: false };
  it('acredita sin consultar deuda y es idempotente', () => {
    expect(acreditar(c, '2026-04-30T12:00:00Z')).toEqual({ tipo: 'ACREDITADO', at: '2026-04-30T12:00:00Z' });
    expect(acreditar({ ...c, acreditadoAt: '2026-04-30T11:00:00Z' }, 'x')).toEqual({ tipo: 'YA_ACREDITADO', at: '2026-04-30T11:00:00Z' });
    expect(acreditar({ ...c, anulada: true }, 'x')).toEqual({ tipo: 'CREDENCIAL_ANULADA' });
  });
  it('controla zonas', () => {
    expect(puedeAcceder(c, 'CAMARINES')).toBe(true);
    expect(puedeAcceder(c, 'PALCO')).toBe(false);
    expect(puedeAcceder({ ...c, anulada: true }, 'CAMARINES')).toBe(false);
  });
});
