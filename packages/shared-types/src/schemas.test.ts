import { PRESET_ENCUENTRO_2026 } from '@soed/domain';
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { configClienteSchema, habilitadoPorModulos, moduloActivo } from './cliente';
import { crearEventoSchema, guardarPlanillaSchema, registrarCobroSchema, reservaEntradaSchema } from './entradas';
import { reglamentoSchema } from './reglamento';
import { ajusteSchema, tarifarioSchema } from './tarifario';

describe('[TR-31] validación en el borde', () => {
  it('[TR-01] acepta el preset y reporta errores de coherencia del dominio', () => {
    expect(reglamentoSchema.safeParse(PRESET_ENCUENTRO_2026).success).toBe(true);
    const roto = {
      ...PRESET_ENCUENTRO_2026,
      toleranciaGrupo: { ...PRESET_ENCUENTRO_2026.toleranciaGrupo, porcentaje: 30 },
      bandas: [...PRESET_ENCUENTRO_2026.bandas].reverse(),
    };
    const r = reglamentoSchema.safeParse(roto);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toContain('BANDAS_NO_ORDENADAS');
  });

  it('[OR-06] valida el tarifario y los ajustes', () => {
    expect(
      tarifarioSchema.safeParse({
        moneda: 'BRL',
        porBailarin: { precio: 10000 },
        recargos: [
          { codigo: 'QUADRO', nombre: { es: 'Quadro' }, tipo: 'MULTIPLICADOR_COREOGRAFIA', filtro: { formacion: 'QUADRO' }, factor: 2 },
        ],
      }).success,
    ).toBe(true);
    expect(tarifarioSchema.safeParse({ moneda: 'EUR' }).success).toBe(false);
    expect(tarifarioSchema.safeParse({ moneda: 'BRL', porBailarin: { precio: 10.5 } }).success).toBe(false);
    expect(ajusteSchema.safeParse({ tipo: 'SIN_CARGO', motivo: 'ok' }).success).toBe(false);
  });

  it('[OP-20] exige client_uuid y monto positivo en cobros', () => {
    const base = { liquidacionId: randomUUID(), montoCentavos: 500, moneda: 'ARS', clientUuid: randomUUID() };
    const ok = registrarCobroSchema.safeParse(base);
    expect(ok.success && ok.data.medio).toBe('EFECTIVO');
    expect(registrarCobroSchema.safeParse({ ...base, montoCentavos: 0 }).success).toBe(false);
    expect(registrarCobroSchema.safeParse({ ...base, clientUuid: 'x' }).success).toBe(false);
  });

  it('normaliza el slug del evento y valida las fechas', () => {
    const e = {
      temporadaId: randomUUID(),
      slug: 'floripa26',
      tipo: 'FINAL',
      nombre: { es: 'Final' },
      moneda: 'BRL',
      idiomaDefecto: 'pt-BR',
      zonaHoraria: 'America/Sao_Paulo',
      fechaInicio: '2027-04-30',
      fechaFin: '2027-05-04',
      sede: { ciudad: 'Florianópolis' },
    };
    const r = crearEventoSchema.safeParse(e);
    expect(r.success && r.data.slug).toBe('FLORIPA26');
    expect(crearEventoSchema.safeParse({ ...e, fechaFin: '2027-04-01' }).success).toBe(false);
    expect(crearEventoSchema.safeParse({ ...e, nombre: { es: ' ' } }).success).toBe(false);
  });

  it('valida planillas y reservas públicas con honeypot', () => {
    expect(guardarPlanillaSchema.safeParse({ fichaId: randomUUID(), notas: [], enviar: false, clientUuid: randomUUID() }).success).toBe(
      true,
    );
    const reserva = { entradaTipoId: randomUUID(), nombre: 'Ana', email: 'ana@example.com', cantidad: 2 };
    expect(reservaEntradaSchema.safeParse(reserva).success).toBe(true);
    expect(reservaEntradaSchema.safeParse({ ...reserva, sitioWeb: 'spam.com' }).success).toBe(false);
  });
});

describe('[TR-37] [SA-14] client.config', () => {
  const base = {
    slug: 'demo',
    nombre: 'Demo',
    nombreCorto: 'Demo',
    descripcion: { es: 'x' },
    dominio: 'demo.example.com',
    idiomas: ['es', 'pt-BR'],
    idiomaDefecto: 'es',
    zonaHorariaDefecto: 'America/Sao_Paulo',
    modulos: { inscripciones: true },
    email: { remitente: 'hola@example.com', nombreRemitente: 'Demo' },
    reglamentoPreset: 'encuentro-2026',
    marca: { logo: '/cliente/logo.svg', logoAlt: 'Demo', favicon: '/cliente/favicon.svg', colorTema: '#112233' },
    legal: { razonSocial: 'Demo SA', contactoEmail: 'legal@example.com', terminos: {}, privacidad: {} },
  };
  it('acepta una configuración completa', () => {
    expect(configClienteSchema.safeParse(base).success).toBe(true);
  });
  it('falla si el idioma por defecto no está habilitado o falta un campo', () => {
    expect(configClienteSchema.safeParse({ ...base, idiomas: ['es'], idiomaDefecto: 'pt-BR' }).success).toBe(false);
    const { dominio: _omitido, ...sinDominio } = base;
    expect(configClienteSchema.safeParse(sinDominio).success).toBe(false);
  });

  it('[TR-39] los módulos ausentes están apagados y una función de varios módulos basta con uno', () => {
    const config = configClienteSchema.parse({ ...base, modulos: { inscripciones: true, entradas: true } });
    expect(moduloActivo(config, 'hoteles')).toBe(false);
    expect(habilitadoPorModulos(config, ['clases', 'entradas'])).toBe(true);
    expect(habilitadoPorModulos(config, ['clases', 'hoteles'])).toBe(false);
    expect(habilitadoPorModulos(config, [])).toBe(true);
  });
});

describe('[OR-16] campos adicionales', () => {
  it('exige opciones en los campos de opción y un código estable', async () => {
    const { campoAdicionalSchema, leerCamposAdicionales } = await import('./campos');
    const base = { etiqueta: { es: 'Talle de remera' }, obligatorio: true };
    expect(campoAdicionalSchema.safeParse({ ...base, codigo: 'talle', tipo: 'OPCION', opciones: ['S'] }).success).toBe(false);
    expect(campoAdicionalSchema.safeParse({ ...base, codigo: 'Talle!', tipo: 'TEXTO' }).success).toBe(false);
    expect(campoAdicionalSchema.parse({ ...base, codigo: 'talle', tipo: 'TEXTO', opciones: ['x'] }).opciones).toBeUndefined();
    expect(leerCamposAdicionales({ ficha: 'roto' })).toEqual({ inscripcion: [], ficha: [] });
  });
});
