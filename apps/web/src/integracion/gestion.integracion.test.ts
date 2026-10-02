import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { construirSesion } from '@/lib/auth/permisos';
import { anularCobro, registrarCobro } from '@/modules/cobros/application/cobros';
import { puertosCobroSupabase } from '@/modules/cobros/infrastructure/puertos-cobro-supabase';
import { enviarComunicado } from '@/modules/comunicaciones/application/comunicados';
import { puertosComunicadosSupabase } from '@/modules/comunicaciones/infrastructure/puertos-comunicados-supabase';
import { crearEvento } from '@/modules/eventos/application/crear-evento';
import { puertosEventosSupabase } from '@/modules/eventos/infrastructure/puertos-eventos-supabase';
import { gestionarFicha } from '@/modules/inscripciones/application/gestion-fichas';
import { puertosGestionFichaSupabase } from '@/modules/inscripciones/infrastructure/puertos-gestion-ficha-supabase';
import { asignarFichasABloque, cambiarEstadoOrden } from '@/modules/orden/application/orden';
import { puertosOrdenSupabase } from '@/modules/orden/infrastructure/puertos-orden-supabase';
import { registrarPase } from '@/modules/pases/application/pases';
import { puertosPaseSupabase } from '@/modules/pases/infrastructure/puertos-pase-supabase';
import { calcularResultados } from '@/modules/puntajes/application/resultados';
import { puertosResultadosSupabase } from '@/modules/puntajes/infrastructure/puertos-resultados-supabase';
import { clienteDe, ids, sql } from './utilidades';

/*
 * Paneles del organizador, Super Admin y roles operativos sobre PostgREST real:
 * casos de uso + adaptadores + RLS + triggers. Cada bloque usa sus propios
 * datos para no depender del orden de ejecución.
 */

async function contexto(clave: string) {
  const db = clienteDe(clave);
  return { db, sesion: await construirSesion(db, { id: ids[clave]! }) };
}

describe('[OR-28] [OR-29] [OR-30] cobros con RLS y trigger', () => {
  it('el staff registra un cobro, es idempotente por client_uuid y no puede anular', async () => {
    const { db, sesion } = await contexto('staff_a');
    const p = puertosCobroSupabase(db, sesion);
    const antes = Number(sql(`select cobrado_centavos from public.v_liquidacion_estado where liquidacion_id = '${ids.liq1}'`));
    const clientUuid = randomUUID();
    const r = await registrarCobro(p, { liquidacionId: ids.liq1!, montoCentavos: 4000, moneda: 'BRL', medio: 'PIX', clientUuid });
    expect(r).toMatchObject({ ok: true, value: { duplicado: false } });
    expect(
      await registrarCobro(p, { liquidacionId: ids.liq1!, montoCentavos: 4000, moneda: 'BRL', medio: 'PIX', clientUuid }),
    ).toMatchObject({
      ok: true,
      value: { duplicado: true },
    });
    expect(Number(sql(`select cobrado_centavos from public.v_liquidacion_estado where liquidacion_id = '${ids.liq1}'`))).toBe(antes + 4000);
    expect(sql(`select registrado_por from public.cobro where client_uuid = '${clientUuid}'`)).toBe(ids.staff_a);
    if (!r.ok) throw new Error('cobro');
    expect(await anularCobro(p, r.value.cobroId, 'error de carga')).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });

  it('rechaza moneda distinta y el organizador de otro evento no ve la liquidación', async () => {
    const { db, sesion } = await contexto('staff_a');
    expect(
      await registrarCobro(puertosCobroSupabase(db, sesion), {
        liquidacionId: ids.liq1!,
        montoCentavos: 100,
        moneda: 'ARS',
        medio: 'PIX',
        clientUuid: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { codigo: 'MONEDA_DISTINTA' } });
    const b = await contexto('org_b');
    expect(
      await registrarCobro(puertosCobroSupabase(b.db, b.sesion), {
        liquidacionId: ids.liq1!,
        montoCentavos: 100,
        moneda: 'BRL',
        medio: 'PIX',
        clientUuid: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { codigo: 'LIQUIDACION_INEXISTENTE' } });
  });

  it('el organizador anula con motivo una sola vez y el cobro no se borra', async () => {
    const staff = await contexto('staff_a');
    const r = await registrarCobro(puertosCobroSupabase(staff.db, staff.sesion), {
      liquidacionId: ids.liq1!,
      montoCentavos: 1000,
      moneda: 'BRL',
      medio: 'EFECTIVO',
      clientUuid: randomUUID(),
    });
    if (!r.ok) throw new Error('cobro');
    const { db, sesion } = await contexto('org_a');
    const p = puertosCobroSupabase(db, sesion);
    expect(await anularCobro(p, r.value.cobroId, 'monto equivocado')).toEqual({ ok: true, value: true });
    expect(await anularCobro(p, r.value.cobroId, 'otra vez')).toMatchObject({ ok: false, error: { codigo: 'COBRO_YA_ANULADO' } });
    expect(
      sql(
        `select anulado_por = '${ids.org_a}' and motivo_anulacion = 'monto equivocado' from public.cobro where id = '${r.value.cobroId}'`,
      ),
    ).toBe('t');
    expect((await db.from('cobro').delete().eq('id', r.value.cobroId)).error?.code).toBe('42501');
  });
});

describe('[OR-21] [OR-22] [OR-23] gestión de fichas por el organizador', () => {
  let fichaId = '';
  beforeAll(() => {
    fichaId = sql(`
      with c as (
        insert into public.coreografia (academia_id, nombre, genero, formacion)
        values ('${ids.academia2}', 'Solo observado', 'JAZZ', 'SOLO') returning id
      )
      insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion, categoria, estado, validacion)
      select '${ids.evento_a}', '${ids.academia2}', '${ids.insc2}', c.id, 'Solo observado', 'JAZZ', 'SOLO', 'JUVENIL', 'OBSERVADA',
             '{"valida":false,"infracciones":[{"codigo":"TIEMPO_EXCEDIDO"}]}'
        from c returning id`).split('\n')[0]!;
  });

  it('observa, no aprueba una ficha inválida sin excepción y aprueba con excepción registrada', async () => {
    const { db, sesion } = await contexto('org_a');
    const p = puertosGestionFichaSupabase(db, sesion);
    expect(await gestionarFicha(p, { accion: 'OBSERVAR', fichaId, observacion: 'Música excede el tiempo' }, new Date())).toEqual({
      ok: true,
      value: true,
    });
    expect(sql(`select estado || '|' || observacion from public.ficha where id = '${fichaId}'`)).toBe('OBSERVADA|Música excede el tiempo');
    expect(await gestionarFicha(p, { accion: 'APROBAR', fichaId }, new Date())).toMatchObject({
      ok: false,
      error: { codigo: 'FICHA_INVALIDA' },
    });
    expect(await gestionarFicha(p, { accion: 'EXCEPCION', fichaId, motivo: 'Autorizado por la organización' }, new Date())).toEqual({
      ok: true,
      value: true,
    });
    expect(sql(`select excepcion ->> 'por' from public.ficha where id = '${fichaId}'`)).toBe(ids.org_a);
    expect(await gestionarFicha(p, { accion: 'APROBAR', fichaId }, new Date())).toEqual({ ok: true, value: true });
    expect(sql(`select estado from public.ficha where id = '${fichaId}'`)).toBe('APROBADA');
  });

  it('el staff con inscripciones.ver no gestiona fichas', async () => {
    const { db, sesion } = await contexto('staff_a');
    expect(
      await gestionarFicha(puertosGestionFichaSupabase(db, sesion), { accion: 'BLOQUEAR', fichaId, bloqueada: true }, new Date()),
    ).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
  });
});

describe('[OR-37] [OP-07] orden de salida', () => {
  it('asigna al bloque las fichas sin orden en el orden que propone el dominio', async () => {
    // Evento B aislado: pista, bloque y dos fichas enviadas de la academia 2.
    const bloque = sql(`
      with p as (insert into public.pista (evento_id, nombre) values ('${ids.evento_b}', '{"es":"Pista B"}') returning id)
      insert into public.bloque (evento_id, pista_id, nombre) select '${ids.evento_b}', p.id, '{"es":"Bloque B"}' from p returning id`).split(
      '\n',
    )[0]!;
    for (const [nombre, categoria] of [
      ['Solo juvenil B', 'JUVENIL'],
      ['Solo infantil B', 'INFANTIL'],
    ]) {
      sql(`
        with c as (insert into public.coreografia (academia_id, nombre, genero, formacion) values ('${ids.academia2}', '${nombre}', 'JAZZ', 'SOLO') returning id)
        insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion, categoria, estado, validacion)
        select '${ids.evento_b}', '${ids.academia2}', '${ids.insc2b}', c.id, '${nombre}', 'JAZZ', 'SOLO', '${categoria}', 'ENVIADA', '{"valida":true}' from c`);
    }
    const { db, sesion } = await contexto('org_b');
    expect(await asignarFichasABloque(puertosOrdenSupabase(db, sesion), bloque)).toEqual({ ok: true, value: { agregadas: 2 } });
    // Las categorías menores salen primero (orden del reglamento); la ficha en borrador no entra.
    expect(
      sql(
        `select string_agg(f.nombre, ',' order by o.posicion) from public.orden_item o join public.ficha f on f.id = o.ficha_id where o.bloque_id = '${bloque}'`,
      ),
    ).toBe('Solo infantil B,Solo juvenil B');
    const a = await contexto('org_a');
    expect(await asignarFichasABloque(puertosOrdenSupabase(a.db, a.sesion), bloque)).toMatchObject({
      ok: false,
      error: { codigo: 'BLOQUE_INEXISTENTE' },
    });
  });

  it('opera estados en vivo con una sola coreografía en escena por pista', async () => {
    const { db, sesion } = await contexto('coord_a');
    const p = puertosOrdenSupabase(db, sesion);
    expect(await cambiarEstadoOrden(p, ids.item1!, 'EN_ESCENA')).toEqual({ ok: true, value: 'EN_ESCENA' });
    expect(await cambiarEstadoOrden(p, ids.item2!, 'EN_ESCENA')).toEqual({ ok: true, value: 'EN_ESCENA' });
    expect(sql(`select string_agg(estado, ',' order by posicion) from public.orden_item where bloque_id = '${ids.bloque1}'`)).toBe(
      'PRESENTADA,EN_ESCENA',
    );
    expect(await cambiarEstadoOrden(p, ids.item1!, 'AUSENTE')).toMatchObject({ ok: false, error: { codigo: 'TRANSICION_INVALIDA' } });
  });

  it('el locutor solo ve el orden: no puede operar', async () => {
    const { db, sesion } = await contexto('loc_a');
    expect(await cambiarEstadoOrden(puertosOrdenSupabase(db, sesion), ids.item2!, 'PRESENTADA')).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
  });
});

describe('[JU-03] [OR-41] [TR-08] planillas de jurado y cálculo de resultados', () => {
  async function cargarPlanilla(jurado: string, fichaId: string, tec: number, int: number) {
    const db = clienteDe(jurado);
    const academia = sql(`select academia_id from public.ficha where id = '${fichaId}'`);
    const { data: pl, error } = await db
      .from('planilla')
      .insert({ evento_id: ids.evento_a!, academia_id: academia, ficha_id: fichaId, jurado_id: ids[jurado]! })
      .select('id')
      .single();
    expect(error).toBeNull();
    await db.from('planilla_nota').insert([
      { planilla_id: pl!.id, criterio_id: ids.crit_tec!, evento_id: ids.evento_a!, valor: tec },
      { planilla_id: pl!.id, criterio_id: ids.crit_int!, evento_id: ids.evento_a!, valor: int },
    ]);
    expect((await db.from('planilla').update({ estado: 'ENVIADA' }).eq('id', pl!.id)).error).toBeNull();
  }

  it('calcula puntaje, banda y puesto por grupo; las fichas incompletas quedan pendientes', async () => {
    const sinPlanillas = sql(`
      with c as (insert into public.coreografia (academia_id, nombre, genero, formacion) values ('${ids.academia2}', 'Solo sin planillas', 'JAZZ', 'SOLO') returning id)
      insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion, categoria, estado, validacion)
      select '${ids.evento_a}', '${ids.academia2}', '${ids.insc2}', c.id, 'Solo sin planillas', 'JAZZ', 'SOLO', 'JUVENIL', 'ENVIADA', '{"valida":true}' from c
      returning id`).split('\n')[0]!;
    await cargarPlanilla('jur1_a', ids.ficha1!, 9.5, 9);
    await cargarPlanilla('jur2_a', ids.ficha1!, 9, 9);
    await cargarPlanilla('jur1_a', ids.ficha2!, 8, 8.5);
    await cargarPlanilla('jur2_a', ids.ficha2!, 7, 8);
    const { db, sesion } = await contexto('dt_a');
    const r = await calcularResultados(puertosResultadosSupabase(db, sesion), ids.evento_a!, { juradosEsperados: 2 });
    if (!r.ok) throw new Error(r.error.codigo);
    const porFicha = new Map(r.value.resultados.map((x) => [x.fichaId, x]));
    // (9.5·2 + 9)/3 = 9.33 y 9 → 9.17; (8·2 + 8.5)/3 = 8.17 y (7·2 + 8)/3 = 7.33 → 7.75
    expect(porFicha.get(ids.ficha1!)).toMatchObject({ puntaje: 9.17, banda: 'ORO', puesto: 1 });
    expect(porFicha.get(ids.ficha2!)).toMatchObject({ puntaje: 7.75, puesto: 2 });
    expect(r.value.pendientes).toContain(sinPlanillas);
    expect(sql(`select count(*) from public.resultado where evento_id = '${ids.evento_a}'`)).toBe('2');
  });

  it('el jurado no puede calcular ni la academia leer resultados sin publicar (Art. 32)', async () => {
    const j = await contexto('jur1_a');
    expect(await calcularResultados(puertosResultadosSupabase(j.db, j.sesion), ids.evento_a!, { juradosEsperados: 2 })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
    expect((await clienteDe('prof1').from('resultado').select('ficha_id')).data).toEqual([]);
  });
});

describe('[OR-33] [TR-13] pases manuales', () => {
  it('registra el pase con traza y valida destino y permisos', async () => {
    const { db, sesion } = await contexto('org_a');
    const p = puertosPaseSupabase(db, sesion);
    const base = {
      eventoOrigenId: ids.evento_a!,
      academiaId: ids.academia1!,
      coreografiaId: ids.coreo1!,
      motivo: 'Primer puesto Infanto Juvenil',
    };
    const r = await registrarPase(p, {
      ...base,
      eventoDestinoId: ids.evento_final!,
      beneficio: { tipo: 'DESCUENTO_PORCENTAJE', porcentaje: 50 },
    });
    expect(r.ok).toBe(true);
    expect(sql(`select registrado_por from public.pase where coreografia_id = '${ids.coreo1}'`)).toBe(ids.org_a);
    expect(await registrarPase(p, { ...base, eventoDestinoId: ids.evento_a! })).toMatchObject({
      ok: false,
      error: { codigo: 'DESTINO_INVALIDO' },
    });
    const b = await contexto('org_b');
    expect(await registrarPase(puertosPaseSupabase(b.db, b.sesion), { ...base, eventoDestinoId: ids.evento_final! })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
  });
});

describe('[OR-47] [TR-21] comunicados bilingües', () => {
  it('encola un email por destinatario en su idioma y en modo sink no sale a terceros', async () => {
    sql(`update public.perfil set idioma = 'pt-BR' where id = '${ids.prof2}'`);
    const { db, sesion } = await contexto('org_a');
    const r = await enviarComunicado(puertosComunicadosSupabase(db, sesion), {
      eventoId: ids.evento_a!,
      asunto: { es: 'Cambio de horario', 'pt-BR': 'Mudança de horário' },
      cuerpo: { es: 'El bloque 2 empieza a las 15 h.', 'pt-BR': 'O bloco 2 começa às 15 h.' },
      audiencia: ['ACADEMIAS'],
    });
    expect(r).toMatchObject({ ok: true, value: { enviados: 2, porIdioma: { es: 1, 'pt-BR': 1 } } });
    expect(sql(`select string_agg(distinct estado, ',') from public.email_envio where plantilla = 'comunicado'`)).toBe('SIMULADO');
    expect(sql(`select payload ->> 'asunto' from public.email_envio where usuario_id = '${ids.prof2}' and plantilla = 'comunicado'`)).toBe(
      'Mudança de horário',
    );
    const { data } = await clienteDe('prof1').from('comunicado').select('asunto').eq('evento_id', ids.evento_a!);
    expect(data?.length).toBe(1);
  });
});

describe('[SA-02] [SA-03] alta de eventos por el Super Admin', () => {
  it('clona configuración (reglamento, criterios, pistas) sin datos operativos', async () => {
    const { db, sesion } = await contexto('sa');
    const r = await crearEvento(puertosEventosSupabase(db, sesion), {
      temporadaId: ids.temporada!,
      slug: 'SELC',
      tipo: 'SELECTIVO',
      nombre: { es: 'Selectivo C', 'pt-BR': 'Seletiva C' },
      moneda: 'USD',
      idiomaDefecto: 'es',
      zonaHoraria: 'America/Argentina/Buenos_Aires',
      fechaInicio: '2027-05-01',
      fechaFin: '2027-05-02',
      sede: { ciudad: 'Montevideo' },
      clonarDeEventoId: ids.evento_a!,
    });
    if (!r.ok) throw new Error(r.error.codigo);
    const id = r.value.eventoId;
    expect(sql(`select count(*) from public.criterio where evento_id = '${id}'`)).toBe('2');
    expect(sql(`select count(*) from public.pista where evento_id = '${id}'`)).toBe('1');
    expect(sql(`select count(*) from public.ficha where evento_id = '${id}'`)).toBe('0');
    expect(sql(`select tarifario ->> 'moneda' from public.evento where id = '${id}'`)).toBe('USD');
    expect(sql(`select publicado from public.evento where id = '${id}'`)).toBe('f');
  });

  it('el organizador no crea eventos y los slugs no se repiten', async () => {
    const o = await contexto('org_a');
    const base = {
      temporadaId: ids.temporada!,
      tipo: 'SELECTIVO' as const,
      nombre: { es: 'X' },
      moneda: 'BRL' as const,
      idiomaDefecto: 'es',
      zonaHoraria: 'America/Sao_Paulo',
      fechaInicio: '2027-06-01',
      fechaFin: '2027-06-01',
      sede: {},
    };
    expect(await crearEvento(puertosEventosSupabase(o.db, o.sesion), { ...base, slug: 'SELX' })).toMatchObject({
      ok: false,
      error: { codigo: 'SIN_PERMISO' },
    });
    const s = await contexto('sa');
    expect(await crearEvento(puertosEventosSupabase(s.db, s.sesion), { ...base, slug: 'SELA' })).toMatchObject({
      ok: false,
      error: { codigo: 'SLUG_EN_USO' },
    });
  });
});
