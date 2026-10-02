-- [JU-03] [JU-06] [JU-07] [OP-01] [OP-03] [OR-42] [PR-25] [TR-14] Puntajes y visibilidad (Art. 32)
begin;
select plan(24);
select tests.escenario();

-- Jurado 1 carga su planilla
select tests.como(tests.id('jur1_a'));
select lives_ok(
  format($$insert into public.planilla (id, evento_id, academia_id, ficha_id, jurado_id, comentario)
           values ('b0000000-0000-4000-8000-000000000001', %L, %L, %L, auth.uid(), 'Muy buena técnica')$$,
         tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1')),
  '[JU-03] el jurado crea su planilla');
select lives_ok(
  format($$insert into public.planilla_nota (planilla_id, criterio_id, evento_id, valor) values
           ('b0000000-0000-4000-8000-000000000001', %L, %L, 9.5)$$, tests.id('crit_tec'), tests.id('evento_a')),
  '[JU-03] carga una nota');
select throws_ok(
  format($$insert into public.planilla_nota (planilla_id, criterio_id, evento_id, valor) values
           ('b0000000-0000-4000-8000-000000000001', %L, %L, 10.5)$$, tests.id('crit_int'), tests.id('evento_a')),
  'P0001', 'NOTA_FUERA_DE_ESCALA', '[JU-03] nota fuera de escala');
select throws_ok(
  format($$insert into public.planilla_nota (planilla_id, criterio_id, evento_id, valor) values
           ('b0000000-0000-4000-8000-000000000001', %L, %L, 8.25)$$, tests.id('crit_int'), tests.id('evento_a')),
  'P0001', 'DECIMALES_EXCEDIDOS', '[JU-03] decimales según el reglamento');
select throws_ok(
  $$update public.planilla set estado = 'ENVIADA' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'CRITERIO_FALTANTE', '[JU-06] no se envía sin todos los criterios');
select lives_ok(
  format($$insert into public.planilla_nota (planilla_id, criterio_id, evento_id, valor) values
           ('b0000000-0000-4000-8000-000000000001', %L, %L, 8)$$, tests.id('crit_int'), tests.id('evento_a')),
  'completa el segundo criterio');
select is((select total from public.planilla where id = 'b0000000-0000-4000-8000-000000000001'), 9.0000::numeric,
  '[JU-03] total ponderado: (9,5×2 + 8×1) / 3 = 9');
select throws_ok(
  $$update public.planilla set total = 10 where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '42501', 'CAMPO_DERIVADO', 'el jurado no escribe el total');
select lives_ok($$update public.planilla set estado = 'ENVIADA' where id = 'b0000000-0000-4000-8000-000000000001'$$, '[JU-06] envía la planilla');
select throws_ok(
  $$update public.planilla set comentario = 'cambio' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'PLANILLA_ENVIADA', '[JU-06] una planilla enviada no se edita');

-- Aislamiento entre jurados y supervisión
select tests.como(tests.id('jur2_a'));
select is((select count(*)::int from public.planilla), 0, '[JU-07] un jurado no ve planillas de otro');
insert into public.planilla (evento_id, academia_id, ficha_id, jurado_id)
values (tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1'), tests.id('jur1_a'));
select is((select count(*)::int from public.planilla where jurado_id = tests.id('jur2_a')), 1,
  '[JU-07] intentar firmar como otro jurado crea la planilla a nombre propio');
select tests.como(tests.id('dt_a'));
select is((select count(*)::int from public.planilla), 2, '[OP-01] el director técnico ve todas las planillas');
select throws_ok(
  $$update public.planilla set estado = 'REABIERTA' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  'P0001', 'MOTIVO_REQUERIDO', '[OP-03] reabrir exige motivo');
select lives_ok(
  $$update public.planilla set estado = 'REABIERTA', motivo_reapertura = 'Error de carga' where id = 'b0000000-0000-4000-8000-000000000001'$$,
  '[OP-03] el director técnico reabre con motivo');
select tests.como(tests.id('jur1_a'));
select lives_ok($$update public.planilla set estado = 'ENVIADA' where id = 'b0000000-0000-4000-8000-000000000001'$$, 'el jurado vuelve a enviar');

-- Resultado calculado por el servidor
select tests.como_servidor();
insert into public.resultado (ficha_id, evento_id, academia_id, puntaje, banda, grupo, puesto)
values (tests.id('ficha1'), tests.id('evento_a'), tests.id('academia1'), 9, 'ORO', 'INFANTO_JUVENIL|SOLO|JAZZ', 1);

-- Antes de publicar: la academia no ve notas, comentarios ni resultados
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.planilla), 0, '[TR-14] sin publicación la academia no ve planillas');
select is((select count(*)::int from public.resultado), 0, '[TR-14] ni resultados');

-- Publicar requiere permiso
select tests.como(tests.id('coord_a'));
select is(tests.filas(format($$update public.evento set resultados_publicados_at = now() where id = %L$$, tests.id('evento_a'))), 0,
  '[OR-42] el coordinador no publica resultados');
select tests.como(tests.id('org_a'));
select lives_ok(format($$update public.evento set resultados_publicados_at = now() where id = %L$$, tests.id('evento_a')), '[OR-42] el organizador publica');

-- Después de publicar: Art. 32
select tests.como(tests.id('prof1'));
select is((select comentario from public.v_devolucion_jurado where ficha_id = tests.id('ficha1')), 'Muy buena técnica',
  '[PR-25] la academia ve el comentario del jurado');
select is((select (notas ->> 'TECNICA')::numeric from public.v_devolucion_jurado where ficha_id = tests.id('ficha1')), 9.5,
  '[PR-25] y las notas por criterio');
select tests.como(tests.id('prof2'));
select is((select count(*)::int from public.planilla), 0, '[TR-14] otra academia no ve esas notas');
select tests.como_anon();
select is((select banda from public.publico_resultados('SELA') limit 1), 'ORO', '[PU-08] resultados públicos tras la publicación');

select * from finish();
rollback;
