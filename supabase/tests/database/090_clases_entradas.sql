-- [OR-51] [OR-52] [OR-53] [PU-09] [PU-10] [PR-31] [TR-34] Clases, entradas, cupos y límite de frecuencia
begin;
select plan(18);
select tests.escenario();

select tests.como(tests.id('org_a'));
select lives_ok($$insert into public.clase (id, evento_id, nombre, inicio, fin, cupo, precio_centavos, publicada)
  values ('cccc0000-0000-4000-8000-000000000001', tests.id('evento_a'), '{"es":"Jazz avanzado"}', now() + interval '60 days', now() + interval '60 days 1 hour', 2, 5000, true)$$,
  '[OR-51] el organizador crea una clase');
select lives_ok($$insert into public.clase (id, evento_id, nombre, inicio, fin, cupo, publicada)
  values ('cccc0000-0000-4000-8000-000000000002', tests.id('evento_a'), '{"es":"Borrador"}', now() + interval '60 days', now() + interval '60 days 1 hour', 5, false)$$,
  'y una clase sin publicar');
select lives_ok($$insert into public.entrada_tipo (id, evento_id, nombre, cupo, precio_centavos, publicada)
  values ('eeee0000-0000-4000-8000-000000000001', tests.id('evento_a'), '{"es":"Platea"}', 3, 2000, true)$$,
  '[OR-52] y un tipo de entrada');
select lives_ok($$insert into public.entrada_tipo (id, evento_id, nombre, cupo, precio_centavos, publicada)
  values ('eeee0000-0000-4000-8000-000000000002', tests.id('evento_a'), '{"es":"General"}', 100, 1000, true)$$,
  'y otro con cupo amplio');

-- Público: catálogo con disponibilidad, sin reservas ni datos personales
select tests.como_anon();
select is((select count(*)::int from public.publico_clases('sela')), 1, '[PU-09] el público ve solo las clases publicadas');
select is((select disponibles from public.publico_entradas('sela') where id = 'eeee0000-0000-4000-8000-000000000001'), 3,
  '[PU-10] con la disponibilidad de entradas');
select throws_ok($$select public.reservar_entrada('eeee0000-0000-4000-8000-000000000001', 'X', 'x@x.com', 1, 'ip')$$,
  '42501', null, 'anon no reserva directo: pasa por el servidor');

-- Servidor: reservas con cupo y límite de frecuencia
select tests.como_servidor();
select is((select count(*)::int from public.reservar_entrada('eeee0000-0000-4000-8000-000000000001', 'Ana', 'ANA@x.com ', 2, 'ip1')), 1,
  '[PU-10] el servidor reserva entradas y devuelve el código');
select throws_ok($$select public.reservar_entrada('eeee0000-0000-4000-8000-000000000001', 'Beto', 'beto@x.com', 2, 'ip2')$$,
  'P0001', 'SIN_CUPO', 'no se supera el cupo de entradas');
select lives_ok($$select public.reservar_clase('cccc0000-0000-4000-8000-000000000001', 'Carla', 'carla@x.com', 'ip3')$$,
  '[PU-09] reserva pública de clase');
select throws_ok($$select public.reservar_clase('cccc0000-0000-4000-8000-000000000002', 'Carla', 'carla@x.com', 'ip3')$$,
  'P0001', 'CLASE_NO_DISPONIBLE', 'una clase sin publicar no se reserva');
select throws_ok($$select public.reservar_entrada('eeee0000-0000-4000-8000-000000000002', 'Spam', 'spam' || g || '@x.com', 1, 'ip-spam')
                     from generate_series(1, 6) g$$,
  'P0001', 'DEMASIADOS_INTENTOS', '[TR-34] el mismo origen no reserva más de 5 veces en 10 minutos');

-- Academia: reserva para sus bailarines dentro del cupo
select tests.como(tests.id('prof1'));
select lives_ok($$insert into public.reserva_clase (clase_id, evento_id, academia_id, nombre)
  values ('cccc0000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia1'), 'Ana Uno')$$,
  '[PR-31] la academia reserva una clase para su bailarina');
select throws_ok($$insert into public.reserva_clase (clase_id, evento_id, academia_id, nombre)
  values ('cccc0000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia1'), 'Bruno Uno')$$,
  'P0001', 'SIN_CUPO', 'la clase llena rechaza más reservas');
select is((select count(*)::int from public.reserva_clase), 1, 'la academia ve solo sus reservas');

-- Cobro manual por quien registra cobros; el staff sin permiso no
select tests.como(tests.id('staff_a'));
select is(tests.filas($$update public.reserva_entrada set pagada = true, cobrado_at = now() where evento_id = tests.id('evento_a')$$), 1,
  '[OR-53] el staff de caja registra el cobro manual de la entrada');
select tests.como(tests.id('jur1_a'));
select is(tests.filas($$update public.reserva_entrada set pagada = false where evento_id = tests.id('evento_a')$$), 0,
  'un jurado no toca reservas');
select tests.como(tests.id('org_a'));
select is((select count(*)::int from public.reserva_entrada where pagada), 1, 'el organizador ve el cobro registrado');

select * from finish();
rollback;
