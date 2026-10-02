-- [OR-09] [OR-54] [PR-30] Hoteles y solicitudes de plazas
begin;
select plan(10);
select tests.escenario();

-- Organizador: alta de hoteles solo en su evento
select tests.como(tests.id('org_a'));
select lives_ok($$insert into public.hotel (id, evento_id, nombre, cupo) values ('aaaa0000-0000-4000-8000-000000000001', tests.id('evento_a'), 'Hotel Centro', 10)$$,
  '[OR-09] el organizador crea un hotel en su evento');
select throws_ok($$insert into public.hotel (evento_id, nombre, cupo) values (tests.id('evento_b'), 'Hotel ajeno', 5)$$,
  '42501', null, 'no crea hoteles en otro evento');
select tests.como(tests.id('org_b'));
select lives_ok($$insert into public.hotel (id, evento_id, nombre, cupo) values ('aaaa0000-0000-4000-8000-000000000002', tests.id('evento_b'), 'Hotel B', 4)$$,
  'el organizador del evento B crea el suyo');

-- Academias: piden plazas solo para su propia inscripción
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.hotel where evento_id = tests.id('evento_a')), 1, '[PR-30] la academia ve los hoteles del evento publicado');
select lives_ok($$insert into public.hotel_solicitud (hotel_id, evento_id, academia_id, inscripcion_id, plazas)
  values ('aaaa0000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia1'), tests.id('insc1'), 3)$$,
  '[PR-30] la academia solicita plazas');
select throws_ok($$insert into public.hotel_solicitud (hotel_id, evento_id, academia_id, inscripcion_id, plazas)
  values ('aaaa0000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia2'), tests.id('insc2'), 3)$$,
  '42501', null, 'no solicita en nombre de otra academia');
select throws_ok($$insert into public.hotel_solicitud (hotel_id, evento_id, academia_id, inscripcion_id, plazas)
  values ('aaaa0000-0000-4000-8000-000000000002', tests.id('evento_a'), tests.id('academia1'), tests.id('insc1'), 1)$$,
  '23503', null, 'el hotel tiene que ser del mismo evento que la inscripción');

select tests.como(tests.id('prof2'));
select lives_ok($$insert into public.hotel_solicitud (hotel_id, evento_id, academia_id, inscripcion_id, plazas)
  values ('aaaa0000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia2'), tests.id('insc2'), 9)$$,
  'otra academia solicita en el mismo hotel');
select is((select count(*)::int from public.hotel_solicitud), 1, '[PR-30] cada academia ve solo sus solicitudes');

select tests.como(tests.id('org_a'));
select is((select sum(plazas)::int from public.hotel_solicitud where evento_id = tests.id('evento_a')), 12,
  '[OR-54] el organizador ve todas las solicitudes para asignar por prioridad');

select * from finish();
rollback;
