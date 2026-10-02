-- [TR-33] [PR-05] [PR-12] [PR-19] [OR-21] [OR-23] Academias, datos de menores y reglas de ficha
begin;
select plan(26);
select tests.escenario();

-- Datos personales de bailarines
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.bailarin), 2, '[PR-05] la academia ve solo sus bailarines');
select is((select count(*)::int from public.bailarin where academia_id = tests.id('academia2')), 0, '[TR-33] no ve bailarines de otra academia');
select is(tests.filas(format($$update public.academia set nombre = 'Hackeada' where id = %L$$, tests.id('academia2'))), 0, '[PR-03] no edita otra academia');
select throws_ok(
  format($$insert into public.bailarin (academia_id, nombre, apellido, fecha_nacimiento) values (%L, 'X', 'Y', '2010-01-01')$$, tests.id('academia2')),
  '42501', null, '[PR-05] no carga bailarines en otra academia');

select tests.como(tests.id('jur1_a'));
select is((select count(*)::int from public.bailarin), 0, '[TR-33] el jurado no ve datos personales de bailarines');
select tests.como(tests.id('loc_a'));
select is((select count(*)::int from public.bailarin), 0, '[TR-33] el locutor no ve datos personales');
select is((select count(*)::int from public.ficha_bailarin where evento_id = tests.id('evento_a')), 2, '[OP-11] el locutor ve los nombres del elenco para anunciar');
select tests.como(tests.id('staff_a'));
select is((select count(*)::int from public.bailarin), 2, '[OP-18] acreditación ve los bailarines inscriptos en su evento');
select tests.como(tests.id('org_b'));
select is((select count(*)::int from public.bailarin where id = tests.id('bailarin1')), 0, '[TR-16] el organizador de B no ve bailarines que solo bailan en A');

-- Alta de academia propia
select tests.como(tests.id('prof2'));
select lives_ok($$insert into public.academia (nombre, creado_por) values ('Nueva', auth.uid())$$, '[PR-03] un profesor crea su academia');
select is((select rol from public.academia_miembro where usuario_id = tests.id('prof2') and academia_id <> tests.id('academia2')), 'TITULAR', 'quien crea la academia queda como titular');

-- Fichas: alta con ventana abierta y columnas derivadas protegidas
select tests.como(tests.id('prof1'));
select lives_ok(
  format($$insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion, estado, validacion)
           values (%L, %L, %L, %L, 'Solo de Bruno', 'JAZZ', 'SOLO', 'APROBADA', '{"valida":true}')$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('insc1'), tests.id('coreo1b')),
  '[PR-10] la academia inscribe una coreografía');
select is(
  (select estado || '/' || coalesce(validacion::text, 'null') from public.ficha where coreografia_id = tests.id('coreo1b')),
  'BORRADOR/null', '[PR-12] el alta ignora estado y validación enviados por el cliente');
select throws_ok(
  format($$update public.ficha set validacion = '{"valida":true,"forzada":1}' where id = %L$$, tests.id('ficha1')),
  '42501', 'CAMPO_DERIVADO', '[PR-12] la academia no escribe la validación');
select throws_ok(
  format($$update public.ficha set estado = 'APROBADA' where id = %L$$, tests.id('ficha1')),
  '42501', 'TRANSICION_RESERVADA', '[OR-21] la academia no aprueba su ficha');
select lives_ok(
  format($$update public.ficha set genero = 'BALLET_CLASICO' where id = %L$$, tests.id('ficha1')),
  '[PR-19] la academia modifica su ficha con la ventana abierta');
select is(
  (select estado || '/' || coalesce(validacion::text, 'null') from public.ficha where id = tests.id('ficha1')),
  'BORRADOR/null', '[TR-11] modificar una ficha enviada invalida la validación y la vuelve a borrador');
select throws_ok(
  format($$update public.ficha set genero = 'TANGO' where id = %L$$, tests.id('ficha1')),
  'P0001', 'GENERO_DESCONOCIDO', '[TR-01] el código de género debe existir en el reglamento del evento');
select lives_ok(
  format($$update public.ficha set estado = 'RETIRADA' where id = %L$$, tests.id('ficha1')),
  '[PR-21] la academia retira una ficha');

-- Servidor: envío solo con validación aprobada o excepción
select tests.como_servidor();
select throws_ok(
  format($$update public.ficha set estado = 'ENVIADA' where id = %L$$, tests.id('ficha1')),
  '23514', null, '[PR-12] ninguna ficha queda enviada sin validación aprobada');

-- Organizador: observa, bloquea y registra excepción
select tests.como(tests.id('org_a'));
select lives_ok(
  format($$update public.ficha set estado = 'OBSERVADA', observacion = 'Falta música' where id = %L$$, tests.id('ficha2')),
  '[OR-21] el organizador observa una ficha');
select lives_ok(
  format($$update public.ficha set bloqueada = true where id = %L$$, tests.id('ficha2')),
  '[OR-23] el organizador bloquea una ficha');
select tests.como(tests.id('prof2'));
select throws_ok(
  format($$update public.ficha set nombre = 'Cambio' where id = %L$$, tests.id('ficha2')),
  'P0001', 'FICHA_NO_MODIFICABLE', '[OR-23] una ficha bloqueada no se modifica');
select throws_ok(
  format($$delete from public.ficha_bailarin where ficha_id = %L$$, tests.id('ficha2')),
  'P0001', 'FICHA_NO_MODIFICABLE', '[OR-23] tampoco su elenco');

-- Ventana cerrada
select tests.como_postgres();
update public.evento set inscripcion_apertura = now() - interval '10 days', inscripcion_cierre = now() - interval '2 days',
                         modificaciones_cierre = now() - interval '1 day'
 where id = tests.id('evento_a');
select tests.como(tests.id('prof1'));
select throws_ok(
  format($$insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion)
           values (%L, %L, %L, %L, 'Tarde', 'JAZZ', 'SOLO')$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('insc1'), tests.id('coreo1')),
  'P0001', null, '[OR-03] no se inscriben fichas con la ventana cerrada');
select lives_ok(
  format($$insert into public.solicitud_modificacion (evento_id, academia_id, ficha_id, descripcion, creado_por)
           values (%L, %L, %L, 'Cambiar la música', auth.uid())$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1')),
  '[PR-20] después del cierre la academia pide una modificación');

select * from finish();
rollback;
