-- [OR-33] [OR-36] [PR-26] [TR-13] [TR-30] [SA-12] [OR-48] [TR-29] [PR-08] [OP-13] Pases, auditoría y storage
begin;
select plan(22);
select tests.escenario();

-- Pases manuales
select tests.como(tests.id('org_a'));
select lives_ok(
  format($$insert into public.pase (id, evento_origen_id, evento_destino_id, academia_id, coreografia_id, motivo, beneficio, registrado_por)
           values ('c0000000-0000-4000-8000-000000000001', %L, %L, %L, %L, 'Segundo puesto: el primero desistió', '{"tipo":"DESCUENTO_PORCENTAJE","porcentaje":20}', %L)$$,
         tests.id('evento_a'), tests.id('evento_final'), tests.id('academia1'), tests.id('coreo1'), tests.id('prof2')),
  '[OR-33] el organizador registra un pase manual con beneficio');
select is((select registrado_por from public.pase where id = 'c0000000-0000-4000-8000-000000000001'), tests.id('org_a'), '[OR-33] queda el autor real');
select throws_ok(
  $$update public.pase set motivo = 'otro' where id = 'c0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'PASE_INMUTABLE', '[OR-36] un pase no se edita');
select throws_ok(
  $$update public.pase set anulado_at = now() where id = 'c0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'MOTIVO_REQUERIDO', '[OR-36] anular exige motivo');
select tests.como(tests.id('org_b'));
select throws_ok(
  format($$insert into public.pase (evento_origen_id, evento_destino_id, academia_id, motivo, registrado_por)
           values (%L, %L, %L, 'Intento ajeno', auth.uid())$$, tests.id('evento_a'), tests.id('evento_final'), tests.id('academia1')),
  '42501', null, '[TR-16] el organizador de B no registra pases desde A');
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.pase), 1, '[PR-26] la academia ve su pase');
select tests.como(tests.id('prof2'));
select is((select count(*)::int from public.pase), 0, '[PR-26] otra academia no lo ve');
select tests.como_postgres();
select is(
  (select count(*)::int from pg_trigger t where t.tgrelid = 'public.pase'::regclass and not t.tgisinternal
      and t.tgname not in ('pase_guardas', 'auditar_pase')),
  0, '[TR-13] no hay reglas automáticas de pase');

-- Auditoría
select tests.como(tests.id('org_a'));
insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por)
values (tests.id('evento_a'), tests.id('academia1'), tests.id('liq1'), 1000, 'BRL', 'PIX', gen_random_uuid(), auth.uid());
select is((select count(*)::int from public.auditoria where tabla = 'cobro' and accion = 'INSERT'), 1, '[TR-30] el alta de cobro queda auditada');
select is((select usuario_id from public.auditoria where tabla = 'pase' limit 1), tests.id('org_a'), '[TR-30] con el autor');
select is((select count(*)::int from public.auditoria where evento_id = tests.id('evento_b')), 0, '[OR-48] el organizador ve solo la auditoría de su evento');
select throws_ok($$delete from public.auditoria$$, '42501', null, '[TR-30] el audit log no se borra');
select throws_ok($$update public.auditoria set tabla = 'x'$$, '42501', null, '[TR-30] ni se modifica');
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.auditoria), 0, '[SA-12] una academia no lee el audit log');
select tests.como(tests.id('sa'));
select ok((select count(*) from public.auditoria) >= 3, '[SA-12] Super Admin ve toda la auditoría');
select tests.como_postgres();
select is(
  (select count(*)::int from public.auditoria where antes::text ~ 'documento_numero|fecha_nacimiento' or despues::text ~ 'documento_numero|fecha_nacimiento'),
  0, '[TR-33] el log no copia datos personales de menores');

-- Storage de música
select tests.como(tests.id('prof1'));
select lives_ok(
  format($$insert into storage.objects (bucket_id, name) values ('musica', %L)$$, tests.id('academia1') || '/' || tests.id('coreo1') || '/solo.mp3'),
  '[PR-08] la academia sube música a su carpeta');
select throws_ok(
  format($$insert into storage.objects (bucket_id, name) values ('musica', %L)$$, tests.id('academia2') || '/' || tests.id('coreo2') || '/x.mp3'),
  '42501', null, '[TR-29] no sube a la carpeta de otra academia');
select tests.como(tests.id('dj_a'));
select is((select count(*)::int from storage.objects where bucket_id = 'musica'), 1, '[OP-13] el DJ del evento accede a la música inscripta');
select tests.como(tests.id('dj_b'));
select is((select count(*)::int from storage.objects where bucket_id = 'musica'), 0, '[TR-29] el DJ de otro evento no');
select tests.como(tests.id('prof2'));
select is((select count(*)::int from storage.objects where bucket_id = 'musica'), 0, '[TR-29] otra academia no');
select tests.como_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'musica'), 0, '[TR-29] anon no');

select * from finish();
rollback;
