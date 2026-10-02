-- [TR-16] [TR-36] [SA-04] [SA-13] Aislamiento por evento y permisos por rol
begin;
select plan(26);
select tests.escenario();

-- Organizador A
select tests.como(tests.id('org_a'));
select is((select count(*)::int from public.ficha where evento_id = tests.id('evento_a')), 2, '[TR-16] organizador A ve las fichas de A');
select is((select count(*)::int from public.ficha where evento_id = tests.id('evento_b')), 0, '[TR-16] organizador A no ve fichas de B');
select is((select count(*)::int from public.inscripcion where evento_id = tests.id('evento_b')), 0, '[TR-16] organizador A no ve inscripciones de B');
select is((select count(*)::int from public.liquidacion where evento_id = tests.id('evento_a')), 2, '[OR-26] organizador A ve liquidaciones de A');
select is(tests.filas(format($$update public.evento set nombre = '{"es":"x"}' where id = %L$$, tests.id('evento_b'))), 0, '[TR-16] organizador A no edita el evento B');
select is(tests.filas(format($$update public.evento set cupo_fichas = 100 where id = %L$$, tests.id('evento_a'))), 1, '[OR-01] organizador A edita su evento');
select throws_ok(
  format($$update public.evento set slug = 'OTRO' where id = %L$$, tests.id('evento_a')),
  'P0001', 'CAMPO_RESERVADO_SUPER_ADMIN', '[SA-02] el slug lo cambia solo Super Admin');
select lives_ok(
  format($$insert into public.evento_miembro (evento_id, usuario_id, rol) values (%L, %L, 'JURADO')$$, tests.id('evento_a'), tests.id('prof2')),
  '[OR-12] organizador A asigna jurados en A');
select throws_ok(
  format($$insert into public.evento_miembro (evento_id, usuario_id, rol) values (%L, %L, 'ORGANIZADOR_EVENTO')$$, tests.id('evento_a'), tests.id('prof2')),
  '42501', null, '[SA-04] solo Super Admin crea organizadores');
select throws_ok(
  format($$insert into public.evento_miembro (evento_id, usuario_id, rol) values (%L, %L, 'JURADO')$$, tests.id('evento_b'), tests.id('prof2')),
  '42501', null, '[TR-16] organizador A no asigna staff en B');
select is((select count(*)::int from public.evento where id = tests.id('evento_final')), 0, '[OR-17] un evento no publicado no es visible para quien no es miembro');

-- Escalada de privilegios
select throws_ok(
  format($$insert into public.rol_global (usuario_id, rol) values (%L, 'SUPER_ADMIN')$$, tests.id('org_a')),
  '42501', null, '[SA-13] nadie se autoasigna Super Admin');
select throws_ok(
  $$insert into public.rol_permiso (rol, permiso) values ('JURADO', 'cobros.anular')$$,
  '42501', null, '[TR-36] un organizador no altera la matriz de permisos');

-- Organizador B
select tests.como(tests.id('org_b'));
select is((select count(*)::int from public.ficha), 1, '[SA-05] organizador B ve solo la ficha de su evento');
select is((select count(*)::int from public.cobro where evento_id = tests.id('evento_a')), 0, '[TR-16] organizador B no ve cobros de A');

-- Super Admin
select tests.como(tests.id('sa'));
select is((select count(*)::int from public.ficha), 3, '[SA-02] Super Admin ve todo');
select throws_ok(
  format($$update public.evento set publicado = true where id = %L$$, tests.id('evento_final')),
  '23514', null, '[OR-02] no se publica un evento en borrador sin pasar por el ciclo de vida');
select lives_ok(
  format($$insert into public.evento (temporada_id, slug, tipo, nombre, moneda, fecha_inicio, fecha_fin, reglamento)
           select temporada_id, 'NUEVO', 'UNICO', '{"es":"Nuevo"}', 'USD', fecha_inicio, fecha_fin, reglamento
             from public.evento where id = %L
           returning id$$, tests.id('evento_a')),
  '[SA-02] Super Admin crea un evento sin publicar y lo lee en el RETURNING');
select lives_ok(
  format($$insert into public.evento_miembro (evento_id, usuario_id, rol) values (%L, %L, 'ORGANIZADOR_EVENTO')$$, tests.id('evento_b'), tests.id('org_a')),
  '[SA-05] Super Admin asigna un organizador a más de un evento');
select tests.como(tests.id('org_a'));
select is((select count(*)::int from public.ficha where evento_id = tests.id('evento_b')), 1, '[SA-05] con dos asignaciones, el organizador ve ambos eventos');

-- Profesor
select tests.como(tests.id('prof1'));
select is((select count(*)::int from public.evento_miembro), 0, 'un profesor no ve el equipo de los eventos');
select is((select count(*)::int from public.evento where publicado), 2, '[PU-03] los eventos publicados son visibles');

-- Estructura (TR-27): RLS habilitada en todas las tablas de public y FKs indexadas.
select tests.como_postgres();
select is(
  (select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  '', '[TR-27] todas las tablas de public tienen RLS');
select is(
  (select coalesce(string_agg(conrelid::regclass::text || '(' || conname || ')', ', '), '')
     from pg_constraint c
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace
      and not exists (
        select 1 from pg_index i
         where i.indrelid = c.conrelid
           and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey
           and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] <@ c.conkey
      )),
  '', 'toda clave foránea tiene índice');

-- Archivado (SA-17): solo el Super Admin archiva; después nadie del evento escribe
select tests.como(tests.id('sa'));
update public.evento set estado = 'ARCHIVADO', publicado = false where id = tests.id('evento_b');
select is((select estado from public.evento where id = tests.id('evento_b')), 'ARCHIVADO', '[SA-17] el Super Admin archiva un evento');
select tests.como(tests.id('org_b'));
select throws_ok(
  format($$update public.evento set nombre = '{"es":"Cambio"}' where id = %L$$, tests.id('evento_b')),
  'P0001', 'EVENTO_ARCHIVADO', '[SA-17] un evento archivado es de solo lectura para su organizador');

select * from finish();
rollback;
