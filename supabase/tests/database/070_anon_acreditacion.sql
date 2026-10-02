-- [PU-03] [PU-04] [TR-33] [OP-17] [OP-22] [OP-25] Acceso anónimo y acreditación
begin;
select plan(14);
select tests.escenario();

select tests.como_anon();
select is((select count(*)::int from public.evento), 2, '[PU-03] anon ve los eventos publicados');
select is((select slug from public.evento where id = tests.id('evento_a')), 'SELA', '[PU-04] con sus columnas públicas');
select throws_ok($$select tarifario from public.evento$$, '42501', null, 'anon no lee el tarifario');
select throws_ok($$select datos_pago from public.evento$$, '42501', null, 'anon no lee los datos de pago');
select throws_ok($$select * from public.bailarin$$, '42501', null, '[TR-33] anon no lee bailarines');
select throws_ok($$select * from public.ficha$$, '42501', null, 'anon no lee fichas');
select throws_ok($$select * from public.perfil$$, '42501', null, 'anon no lee perfiles');
select is((select count(*)::int from public.publico_resultados('SELA')), 0, '[TR-14] sin publicación no hay resultados públicos');

-- Acreditación: idempotente y sin consultar deuda
select tests.como(tests.id('staff_a'));
insert into public.credencial (id, evento_id, tipo, academia_id, bailarin_id, nombre_mostrado, zonas)
values ('d0000000-0000-4000-8000-000000000001', tests.id('evento_a'), 'BAILARIN', tests.id('academia1'), tests.id('bailarin1'), 'Ana Uno', '{CAMARINES}');
select is((select estado from public.v_liquidacion_estado where academia_id = tests.id('academia1')), 'PENDIENTE', 'la academia tiene deuda pendiente');
select lives_ok(
  $$insert into public.acreditacion_registro (evento_id, credencial_id, accion, client_uuid, registrado_por)
    select evento_id, id, 'ACREDITAR', 'e0000000-0000-4000-8000-000000000001', auth.uid() from public.credencial
     where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '[OP-25] se acredita aunque haya deuda');
select isnt((select acreditado_at from public.credencial where id = 'd0000000-0000-4000-8000-000000000001'), null, '[OP-17] la credencial queda acreditada');
select throws_ok(
  $$insert into public.acreditacion_registro (evento_id, credencial_id, accion, client_uuid, registrado_por)
    select evento_id, id, 'ACREDITAR', 'e0000000-0000-4000-8000-000000000001', auth.uid() from public.credencial
     where id = 'd0000000-0000-4000-8000-000000000001'$$,
  '23505', null, '[OP-22] la sincronización offline repetida no duplica');
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.credencial), 1, '[PR-28] la academia ve las credenciales de sus bailarines');
select tests.como(tests.id('jur1_a'));
select is((select count(*)::int from public.credencial), 0, 'un jurado no ve credenciales');

select * from finish();
rollback;
