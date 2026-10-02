import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { construirSesion } from '@/lib/auth/permisos';
import { acreditarPorToken, emitirCredenciales } from '@/modules/acreditacion/application/acreditacion';
import { puertosAcreditacionSupabase } from '@/modules/acreditacion/infrastructure/puertos-acreditacion-supabase';
import { avanzarOrden } from '@/modules/orden/application/orden';
import { puertosOrdenSupabase } from '@/modules/orden/infrastructure/puertos-orden-supabase';
import { guardarPlanilla } from '@/modules/puntajes/application/planillas';
import { puertosPlanillaSupabase } from '@/modules/puntajes/infrastructure/puertos-planilla-supabase';
import { despachar, operacionSchema } from '@/modules/sincronizacion/interface/despachar';
import { clienteDe, ids, sql } from './utilidades';

/* Operación en vivo sobre PostgREST: jurado, acreditación, coordinación y cola offline. */

async function contexto(clave: string) {
  const db = clienteDe(clave);
  return { db, sesion: await construirSesion(db, { id: ids[clave]! }) };
}

/** Ficha enviada propia de este archivo (evento A, academia 2) para no depender del orden de ejecución. */
function fichaNueva(nombre: string, categoria = 'JUVENIL'): string {
  return sql(`
    with c as (insert into public.coreografia (academia_id, nombre, genero, formacion) values ('${ids.academia2}', '${nombre}', 'JAZZ', 'SOLO') returning id)
    insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion, categoria, estado, validacion)
    select '${ids.evento_a}', '${ids.academia2}', '${ids.insc2}', c.id, '${nombre}', 'JAZZ', 'SOLO', '${categoria}', 'ENVIADA', '{"valida":true}' from c
    returning id`).split('\n')[0]!;
}

describe('[JU-03] [JU-05] [ADR-0010] planilla del jurado', () => {
  it('guarda borrador, envía con total ponderado y un reintento no duplica', async () => {
    const fichaId = fichaNueva('Solo para el jurado');
    const { db, sesion } = await contexto('jur1_a');
    const p = puertosPlanillaSupabase(db, sesion);
    const borrador = await guardarPlanilla(p, {
      fichaId,
      notas: [{ criterioId: ids.crit_tec!, valor: 8.5 }],
      enviar: false,
      clientUuid: randomUUID(),
    });
    expect(borrador).toMatchObject({ ok: true, value: { enviada: false } });
    const uuid = randomUUID();
    const envio = await guardarPlanilla(p, {
      fichaId,
      notas: [
        { criterioId: ids.crit_tec!, valor: 9 },
        { criterioId: ids.crit_int!, valor: 7.5 },
      ],
      comentario: 'Gran musicalidad',
      enviar: true,
      clientUuid: uuid,
    });
    expect(envio).toMatchObject({ ok: true, value: { enviada: true, total: 8.5, duplicado: false } });
    expect(sql(`select estado || '|' || total from public.planilla where ficha_id = '${fichaId}'`)).toBe('ENVIADA|8.5000');
    expect(await guardarPlanilla(p, { fichaId, notas: [], enviar: true, clientUuid: uuid })).toMatchObject({
      ok: true,
      value: { duplicado: true },
    });
    expect(await guardarPlanilla(p, { fichaId, notas: [], enviar: false, clientUuid: randomUUID() })).toMatchObject({
      ok: false,
      error: { codigo: 'PLANILLA_ENVIADA' },
    });
  });

  it('el locutor no puede cargar planillas', async () => {
    const { db, sesion } = await contexto('loc_a');
    expect(
      await guardarPlanilla(puertosPlanillaSupabase(db, sesion), {
        fichaId: ids.ficha1!,
        notas: [],
        enviar: false,
        clientUuid: randomUUID(),
      }),
    ).toMatchObject({ ok: false, error: { codigo: 'SIN_PERMISO' } });
  });
});

describe('[OR-50] [OP-16] [OP-17] [TR-12] credenciales y acreditación', () => {
  it('emite credenciales sin duplicar y acredita de forma idempotente aunque haya deuda', async () => {
    const { db, sesion } = await contexto('staff_a');
    const p = puertosAcreditacionSupabase(db, sesion);
    const primera = await emitirCredenciales(p, ids.evento_a!);
    expect(primera.ok && primera.value.emitidas).toBeGreaterThan(0);
    expect(await emitirCredenciales(p, ids.evento_a!)).toEqual({ ok: true, value: { emitidas: 0 } });
    expect(sql(`select count(*) from public.credencial where evento_id = '${ids.evento_a}' and tipo = 'JURADO'`)).toBe('2');

    // Academia 1 tiene saldo pendiente: igual se acredita.
    const token = sql(`select qr_token from public.credencial where evento_id = '${ids.evento_a}' and bailarin_id = '${ids.bailarin1}'`);
    const uuid = randomUUID();
    expect(await acreditarPorToken(p, { qrToken: token, clientUuid: uuid }, new Date())).toMatchObject({
      ok: true,
      value: { resultado: 'ACREDITADO', credencial: { tipo: 'BAILARIN', academia: 'Academia Uno' } },
    });
    expect(await acreditarPorToken(p, { qrToken: token, clientUuid: uuid }, new Date())).toMatchObject({ ok: true });
    expect(await acreditarPorToken(p, { qrToken: token, clientUuid: randomUUID() }, new Date())).toMatchObject({
      ok: true,
      value: { resultado: 'YA_ACREDITADO' },
    });
    expect(sql(`select count(*) from public.acreditacion_registro where client_uuid = '${uuid}'`)).toBe('1');
  });

  it('el DJ no acredita', async () => {
    const { db, sesion } = await contexto('dj_a');
    const token = sql(`select qr_token from public.credencial where evento_id = '${ids.evento_a}' limit 1`);
    expect(
      await acreditarPorToken(puertosAcreditacionSupabase(db, sesion), { qrToken: token, clientUuid: randomUUID() }, new Date()),
    ).toMatchObject({
      ok: false,
      error: { codigo: 'CREDENCIAL_INEXISTENTE' },
    });
  });
});

describe('[OP-05] [OP-06] siguiente en escena', () => {
  it('avanza la pista: presenta, sube a escena y llama a la próxima', async () => {
    const pista = sql(
      `insert into public.pista (evento_id, nombre, orden) values ('${ids.evento_a}', '{"es":"Pista 2"}', 2) returning id`,
    ).split('\n')[0]!;
    const bloque = sql(
      `insert into public.bloque (evento_id, pista_id, nombre) values ('${ids.evento_a}', '${pista}', '{"es":"B"}') returning id`,
    ).split('\n')[0]!;
    const fichas = ['Avance uno', 'Avance dos', 'Avance tres'].map((n) => fichaNueva(n));
    fichas.forEach((f, i) =>
      sql(
        `insert into public.orden_item (evento_id, pista_id, bloque_id, ficha_id, posicion) values ('${ids.evento_a}', '${pista}', '${bloque}', '${f}', ${i + 1})`,
      ),
    );
    const { db, sesion } = await contexto('coord_a');
    const p = puertosOrdenSupabase(db, sesion);
    expect((await avanzarOrden(p, pista)).ok).toBe(true);
    expect(sql(`select string_agg(estado, ',' order by posicion) from public.orden_item where bloque_id = '${bloque}'`)).toBe(
      'EN_ESCENA,LLAMADA,PROGRAMADA',
    );
    expect((await avanzarOrden(p, pista)).ok).toBe(true);
    expect(sql(`select string_agg(estado, ',' order by posicion) from public.orden_item where bloque_id = '${bloque}'`)).toBe(
      'PRESENTADA,EN_ESCENA,LLAMADA',
    );
  });
});

describe('[ADR-0010] despacho de la cola offline', () => {
  it('aplica un cobro encolado y lo rechaza con código si viola una regla', async () => {
    const { db, sesion } = await contexto('staff_a');
    const ok = await despachar(
      operacionSchema.parse({
        tipo: 'cobro',
        datos: { liquidacionId: ids.liq1!, montoCentavos: 500, moneda: 'BRL', medio: 'EFECTIVO', clientUuid: randomUUID() },
      }),
      db,
      sesion,
      new Date(),
    );
    expect(ok).toMatchObject({ ok: true, valor: { duplicado: false } });
    const rechazo = await despachar(
      operacionSchema.parse({
        tipo: 'cobro',
        datos: { liquidacionId: ids.liq1!, montoCentavos: 500, moneda: 'ARS', medio: 'EFECTIVO', clientUuid: randomUUID() },
      }),
      db,
      sesion,
      new Date(),
    );
    expect(rechazo).toEqual({ ok: false, codigo: 'MONEDA_DISTINTA' });
  });
});
