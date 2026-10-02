-- [OR-28] [OR-29] [OR-30] [OP-20] [TR-12] [TR-15] [TR-19] Liquidaciones y cobros
begin;
select plan(25);
select tests.escenario();

-- Staff de acreditación registra un cobro parcial en la mesa
select tests.como(tests.id('staff_a'));
select lives_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 4000, 'BRL', 'PIX', 'a0000000-0000-4000-8000-000000000001', %L)$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1'), tests.id('prof1')),
  '[OP-20] el staff registra un cobro');
select is((select registrado_por from public.cobro where client_uuid = 'a0000000-0000-4000-8000-000000000001'), tests.id('staff_a'),
  '[OR-30] el autor del cobro es siempre quien lo registra');
select is((select estado from public.v_liquidacion_estado where liquidacion_id = tests.id('liq1')), 'PARCIAL', '[TR-19] estado parcial');
select is((select saldo_centavos::int from public.v_liquidacion_estado where liquidacion_id = tests.id('liq1')), 6000, '[OR-29] saldo calculado');
select throws_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 4000, 'BRL', 'PIX', 'a0000000-0000-4000-8000-000000000001', auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1')),
  '23505', null, '[TR-47] el mismo client_uuid no duplica un cobro sincronizado dos veces');
select throws_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 100, 'USD', 'PIX', gen_random_uuid(), auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1')),
  'P0001', 'MONEDA_DISTINTA', '[TR-17] el cobro va en la moneda del evento');
select throws_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 100, 'BRL', 'CHEQUE', gen_random_uuid(), auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1')),
  'P0001', 'MEDIO_NO_HABILITADO', '[OR-08] solo medios habilitados');
select is(
  tests.filas(format($$update public.cobro set motivo_anulacion = 'error', anulado_at = now() where liquidacion_id = %L$$, tests.id('liq1'))),
  0, '[OR-30] el staff no anula cobros');
select is(
  tests.filas(format($$update public.cobro set monto_centavos = 1 where liquidacion_id = %L$$, tests.id('liq1'))),
  0, '[OR-30] el staff no edita cobros (RLS)');

-- Cobro completo y anulación por el organizador
select tests.como(tests.id('org_a'));
select lives_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 6000, 'BRL', 'EFECTIVO', 'a0000000-0000-4000-8000-000000000002', auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1')),
  '[OR-28] el organizador registra el saldo');
select is((select estado from public.v_liquidacion_estado where liquidacion_id = tests.id('liq1')), 'PAGADA', '[TR-19] estado pagada');
select is(
  tests.filas(format($$update public.cobro set anulado_at = now(), motivo_anulacion = 'Duplicado en caja' where client_uuid = %L$$, 'a0000000-0000-4000-8000-000000000002')),
  1, '[OR-30] el organizador anula con motivo');
select is((select anulado_por from public.cobro where client_uuid = 'a0000000-0000-4000-8000-000000000002'), tests.id('org_a'), '[OR-30] queda registrado quién anuló');
select is((select estado from public.v_liquidacion_estado where liquidacion_id = tests.id('liq1')), 'PARCIAL', '[TR-19] los anulados no cuentan');
select throws_ok(
  format($$update public.cobro set motivo_anulacion = 'otra vez', anulado_at = now() where client_uuid = %L$$, 'a0000000-0000-4000-8000-000000000002'),
  'P0001', 'COBRO_YA_ANULADO', '[OR-30] no se anula dos veces');
select throws_ok(
  format($$update public.cobro set monto_centavos = 1 where client_uuid = %L$$, 'a0000000-0000-4000-8000-000000000001'),
  'P0001', 'COBRO_INMUTABLE', '[OR-30] ni el organizador edita el monto: se anula y se registra otro');
select throws_ok(
  format($$delete from public.cobro where liquidacion_id = %L$$, tests.id('liq1')),
  '42501', null, '[OR-30] un cobro nunca se borra (sin privilegio ni política de borrado)');

-- Ni el servidor borra cobros
select tests.como_servidor();
select throws_ok($$delete from public.cobro$$, 'P0001', 'COBRO_NO_SE_BORRA', '[TR-30] append-only incluso con service_role');
select throws_ok(
  format($$update public.liquidacion_version set total_centavos = 1 where liquidacion_id = %L$$, tests.id('liq1')),
  'P0001', 'LIQUIDACION_VERSION_INMUTABLE', '[TR-18] una versión emitida no cambia');

-- Estado sin cargo y visibilidad para la academia
select is((select estado from public.v_liquidacion_estado where liquidacion_id = tests.id('liq2')), 'SIN_CARGO', '[TR-19] total cero es sin cargo');
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.cobro), 2, '[PR-17] la academia ve sus cobros');
select is((select count(*)::int from public.v_liquidacion_estado), 1, '[PR-16] la academia ve solo su liquidación');
select throws_ok($$select public.crear_liquidacion(gen_random_uuid())$$, '42501', null, '[TR-15] la numeración solo la asigna el servidor');
select throws_ok(
  format($$insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
           values (%L, %L, %L, 100, 'BRL', 'PIX', gen_random_uuid(), auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('liq1')),
  '42501', null, '[OR-28] una academia no registra sus propios cobros');

-- [TR-12] Ninguna tabla operativa depende de los cobros
select tests.como_postgres();
select is(
  (select count(*)::int from pg_constraint c
    where c.contype = 'f' and c.confrelid in ('public.cobro'::regclass, 'public.liquidacion'::regclass, 'public.liquidacion_version'::regclass)
      and c.conrelid in ('public.ficha'::regclass, 'public.inscripcion'::regclass, 'public.orden_item'::regclass,
                         'public.credencial'::regclass, 'public.acreditacion_registro'::regclass, 'public.planilla'::regclass)),
  0, '[TR-12] inscripción, orden, puntaje y acreditación no referencian cobros');

select * from finish();
rollback;
