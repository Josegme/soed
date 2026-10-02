-- [OR-38] [OP-06] [OP-07] [OP-08] [OP-09] [PR-23] [PU-07] Orden de salida en vivo
begin;
select plan(16);
select tests.escenario();

-- Coordinador reordena y mueve entre bloques
select tests.como(tests.id('coord_a'));
select lives_ok(format($$select public.reordenar_orden(%L, %L, 1)$$, tests.id('item2'), tests.id('bloque1')), '[OP-08] el coordinador reordena');
select is(
  (select string_agg(ficha_id::text, ',' order by posicion) from public.orden_item where bloque_id = tests.id('bloque1')),
  tests.id('ficha2') || ',' || tests.id('ficha1'), '[OR-38] el orden queda actualizado y contiguo');
select lives_ok(format($$select public.reordenar_orden(%L, %L, 1)$$, tests.id('item1'), tests.id('bloque2')), '[OP-09] mueve una coreografía a otro bloque');
select is((select posicion from public.orden_item where id = tests.id('item2')), 1, 'el bloque de origen se renumera');
select throws_ok(format($$select public.reordenar_orden(%L, %L, 5)$$, tests.id('item2'), tests.id('bloque1')), 'P0001', 'POSICION_INVALIDA', 'posición fuera de rango');
select lives_ok(format($$update public.orden_item set estado = 'EN_ESCENA' where id = %L$$, tests.id('item2')), '[OP-07] marca en escena');
select throws_ok(format($$update public.orden_item set estado = 'EN_ESCENA' where id = %L$$, tests.id('item1')), '23505', null, 'una sola coreografía en escena por pista');

-- Locutor y DJ leen pero no editan
select tests.como(tests.id('loc_a'));
select is((select count(*)::int from public.orden_item), 2, '[OP-11] el locutor ve el orden');
select throws_ok(format($$select public.reordenar_orden(%L, %L, 1)$$, tests.id('item2'), tests.id('bloque1')), '42501', 'SIN_PERMISO', '[OP-11] el locutor no reordena');
select is(tests.filas(format($$update public.orden_item set estado = 'PRESENTADA' where id = %L$$, tests.id('item2'))), 0, 'el locutor no cambia estados');
select tests.como(tests.id('dj_b'));
select is((select count(*)::int from public.orden_item), 0, '[TR-16] el DJ de otro evento no ve este orden');

-- Academias: solo con orden publicado y solo lo propio
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.orden_item), 0, '[PR-23] sin publicación la academia no ve el orden');
select tests.como(tests.id('org_a'));
update public.evento set orden_publicado_at = now() where id = tests.id('evento_a');
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.orden_item), 1, '[PR-23] publicado, la academia ve solo sus coreografías');

-- Público: orden sin datos personales
select tests.como_anon();
select is((select count(*)::int from public.publico_orden('sela')), 2, '[PU-07] el público ve el orden publicado');
select is(
  (select count(*)::int from pg_proc p, unnest(p.proargnames) as arg
    where p.proname in ('publico_orden', 'publico_resultados') and arg ~ '(bailarin|nacimiento|documento|edad|email)'),
  0, '[TR-33] el orden y los resultados públicos no exponen datos de bailarines');
select throws_ok($$select * from public.orden_item$$, '42501', null, 'anon no accede a la tabla de orden');

select * from finish();
rollback;
