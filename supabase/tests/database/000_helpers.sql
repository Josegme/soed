-- Helpers de prueba (persisten para los archivos siguientes; no van en producción).
-- Simulan la sesión de PostgREST: rol + claims del JWT.
create extension if not exists pgtap with schema extensions;
create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

create or replace function tests.crear_usuario(p_email text, p_nombre text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into auth.users (email, raw_user_meta_data)
  values (p_email, jsonb_build_object('nombre', p_nombre))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function tests.como(p_usuario uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_usuario, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.como_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.como_servidor()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
  execute 'set local role service_role';
end;
$$;

create or replace function tests.como_postgres()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Escenario base: 2 eventos (A y B) + final, 2 academias, staff completo de A.
-- Se crea dentro de la transacción de cada archivo de prueba (rollback al final).
-- -----------------------------------------------------------------------------
create or replace function tests.id(p_clave text)
returns uuid
language plpgsql
as $$
declare
  v uuid;
begin
  execute 'select id from pg_temp.escenario where clave = $1' into v using p_clave;
  if v is null then
    raise exception 'clave de escenario inexistente: %', p_clave;
  end if;
  return v;
end;
$$;

create or replace function tests.escenario()
returns void
language plpgsql
as $$
declare
  v_reg jsonb;
  v uuid;
  rec record;
begin
  create temp table if not exists escenario (clave text primary key, id uuid not null);
  grant select on pg_temp.escenario to anon, authenticated, service_role;

  for rec in select unnest(array['sa','org_a','org_b','dt_a','jur1_a','jur2_a','coord_a','loc_a','dj_a','staff_a','prof1','prof2','dj_b']) as clave loop
    insert into pg_temp.escenario values (rec.clave, tests.crear_usuario(rec.clave || '@test.soed', rec.clave));
  end loop;
  insert into public.rol_global (usuario_id, rol) values (tests.id('sa'), 'SUPER_ADMIN');

  select config into v_reg from public.reglamento where preset = 'encuentro-2026';

  insert into public.temporada (anio, nombre, reglamento_id, publicada)
  values (2027, '{"es":"Temporada 2027"}', (select id from public.reglamento where preset = 'encuentro-2026'), true)
  returning id into v;
  insert into pg_temp.escenario values ('temporada', v);

  insert into public.evento (temporada_id, slug, tipo, nombre, moneda, fecha_inicio, fecha_fin,
                             inscripcion_apertura, inscripcion_cierre, modificaciones_cierre, reglamento, publicado,
                             tarifario, datos_pago)
  values (tests.id('temporada'), 'SELA', 'SELECTIVO', '{"es":"Selectivo A"}', 'BRL', current_date + 60, current_date + 61,
          now() - interval '1 day', now() + interval '30 days', now() + interval '35 days', v_reg, true,
          '{"moneda":"BRL"}', '{"es":"PIX: clave","pt-BR":"PIX: chave"}')
  returning id into v;
  insert into pg_temp.escenario values ('evento_a', v);

  insert into public.evento (temporada_id, slug, tipo, nombre, moneda, fecha_inicio, fecha_fin,
                             inscripcion_apertura, inscripcion_cierre, reglamento, publicado)
  values (tests.id('temporada'), 'SELB', 'SELECTIVO', '{"es":"Selectivo B"}', 'ARS', current_date + 90, current_date + 90,
          now() - interval '1 day', now() + interval '30 days', v_reg, true)
  returning id into v;
  insert into pg_temp.escenario values ('evento_b', v);

  insert into public.evento (temporada_id, slug, tipo, nombre, moneda, fecha_inicio, fecha_fin, reglamento, publicado)
  values (tests.id('temporada'), 'FINAL27', 'FINAL', '{"es":"Final"}', 'BRL', current_date + 200, current_date + 204, v_reg, false)
  returning id into v;
  insert into pg_temp.escenario values ('evento_final', v);

  insert into public.evento_miembro (evento_id, usuario_id, rol) values
    (tests.id('evento_a'), tests.id('org_a'), 'ORGANIZADOR_EVENTO'),
    (tests.id('evento_b'), tests.id('org_b'), 'ORGANIZADOR_EVENTO'),
    (tests.id('evento_a'), tests.id('dt_a'), 'DIRECTOR_TECNICO'),
    (tests.id('evento_a'), tests.id('jur1_a'), 'JURADO'),
    (tests.id('evento_a'), tests.id('jur2_a'), 'JURADO'),
    (tests.id('evento_a'), tests.id('coord_a'), 'COORDINADOR'),
    (tests.id('evento_a'), tests.id('loc_a'), 'LOCUTOR'),
    (tests.id('evento_a'), tests.id('dj_a'), 'DJ'),
    (tests.id('evento_a'), tests.id('staff_a'), 'STAFF_ACREDITACION'),
    (tests.id('evento_b'), tests.id('dj_b'), 'DJ');

  insert into public.academia (nombre, ciudad) values ('Academia Uno', 'Florianópolis') returning id into v;
  insert into pg_temp.escenario values ('academia1', v);
  insert into public.academia (nombre, ciudad) values ('Academia Dos', 'Rosario') returning id into v;
  insert into pg_temp.escenario values ('academia2', v);
  insert into public.academia_miembro (academia_id, usuario_id, rol) values
    (tests.id('academia1'), tests.id('prof1'), 'TITULAR'),
    (tests.id('academia2'), tests.id('prof2'), 'TITULAR');

  insert into public.bailarin (academia_id, nombre, apellido, fecha_nacimiento, documento_tipo, documento_numero)
  values (tests.id('academia1'), 'Ana', 'Uno', date '2012-03-10', 'DNI', '11111111') returning id into v;
  insert into pg_temp.escenario values ('bailarin1', v);
  insert into public.bailarin (academia_id, nombre, apellido, fecha_nacimiento)
  values (tests.id('academia1'), 'Bruno', 'Uno', date '2013-07-01') returning id into v;
  insert into pg_temp.escenario values ('bailarin1b', v);
  insert into public.bailarin (academia_id, nombre, apellido, fecha_nacimiento, documento_tipo, documento_numero)
  values (tests.id('academia2'), 'Carla', 'Dos', date '2011-01-20', 'CPF', '22222222') returning id into v;
  insert into pg_temp.escenario values ('bailarin2', v);

  insert into public.coreografia (academia_id, nombre, genero, formacion, musica_path, musica_duracion_seg)
  values (tests.id('academia1'), 'Solo de Ana', 'JAZZ', 'SOLO', tests.id('academia1') || '/x/solo.mp3', 170) returning id into v;
  insert into pg_temp.escenario values ('coreo1', v);
  insert into public.coreografia (academia_id, nombre, genero, formacion)
  values (tests.id('academia2'), 'Solo de Carla', 'JAZZ', 'SOLO') returning id into v;
  insert into pg_temp.escenario values ('coreo2', v);
  insert into public.coreografia (academia_id, nombre, genero, formacion)
  values (tests.id('academia1'), 'Solo de Bruno', 'JAZZ', 'SOLO') returning id into v;
  insert into pg_temp.escenario values ('coreo1b', v);

  insert into public.inscripcion (evento_id, academia_id) values (tests.id('evento_a'), tests.id('academia1')) returning id into v;
  insert into pg_temp.escenario values ('insc1', v);
  insert into public.inscripcion (evento_id, academia_id) values (tests.id('evento_a'), tests.id('academia2')) returning id into v;
  insert into pg_temp.escenario values ('insc2', v);
  insert into public.inscripcion (evento_id, academia_id) values (tests.id('evento_b'), tests.id('academia2')) returning id into v;
  insert into pg_temp.escenario values ('insc2b', v);

  insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion,
                            categoria, estado, validacion, musica_duracion_seg)
  values (tests.id('evento_a'), tests.id('academia1'), tests.id('insc1'), tests.id('coreo1'), 'Solo de Ana', 'JAZZ', 'SOLO',
          'INFANTO_JUVENIL', 'ENVIADA', '{"valida":true}', 170) returning id into v;
  insert into pg_temp.escenario values ('ficha1', v);
  insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion,
                            categoria, estado, validacion)
  values (tests.id('evento_a'), tests.id('academia2'), tests.id('insc2'), tests.id('coreo2'), 'Solo de Carla', 'JAZZ', 'SOLO',
          'INFANTO_JUVENIL', 'ENVIADA', '{"valida":true}') returning id into v;
  insert into pg_temp.escenario values ('ficha2', v);
  insert into public.ficha (evento_id, academia_id, inscripcion_id, coreografia_id, nombre, genero, formacion)
  values (tests.id('evento_b'), tests.id('academia2'), tests.id('insc2b'), tests.id('coreo2'), 'Solo de Carla', 'JAZZ', 'SOLO')
  returning id into v;
  insert into pg_temp.escenario values ('ficha2b', v);

  insert into public.ficha_bailarin (ficha_id, bailarin_id, evento_id, academia_id, nombre_mostrado, edad, categoria) values
    (tests.id('ficha1'), tests.id('bailarin1'), tests.id('evento_a'), tests.id('academia1'), 'Ana Uno', 14, 'INFANTO_JUVENIL'),
    (tests.id('ficha2'), tests.id('bailarin2'), tests.id('evento_a'), tests.id('academia2'), 'Carla Dos', 15, 'JUVENIL'),
    (tests.id('ficha2b'), tests.id('bailarin2'), tests.id('evento_b'), tests.id('academia2'), 'Carla Dos', 15, 'JUVENIL');

  insert into pg_temp.escenario select 'liq1', (public.crear_liquidacion(tests.id('insc1'))).id;
  insert into pg_temp.escenario select 'liq2', (public.crear_liquidacion(tests.id('insc2'))).id;
  insert into public.liquidacion_version (liquidacion_id, evento_id, academia_id, version, total_centavos, moneda, detalle)
  values (tests.id('liq1'), tests.id('evento_a'), tests.id('academia1'), 1, 10000, 'BRL', '{"lineas":[]}'),
         (tests.id('liq2'), tests.id('evento_a'), tests.id('academia2'), 1, 0, 'BRL', '{"lineas":[]}');

  insert into public.criterio (evento_id, codigo, nombre, peso, orden) values
    (tests.id('evento_a'), 'TECNICA', '{"es":"Técnica"}', 2, 1),
    (tests.id('evento_a'), 'INTERPRETACION', '{"es":"Interpretación"}', 1, 2);
  insert into pg_temp.escenario select 'crit_tec', id from public.criterio where evento_id = tests.id('evento_a') and codigo = 'TECNICA';
  insert into pg_temp.escenario select 'crit_int', id from public.criterio where evento_id = tests.id('evento_a') and codigo = 'INTERPRETACION';

  insert into public.pista (evento_id, nombre) values (tests.id('evento_a'), '{"es":"Pista 1"}') returning id into v;
  insert into pg_temp.escenario values ('pista1', v);
  insert into public.bloque (evento_id, pista_id, nombre, orden) values (tests.id('evento_a'), tests.id('pista1'), '{"es":"Bloque 1"}', 1) returning id into v;
  insert into pg_temp.escenario values ('bloque1', v);
  insert into public.bloque (evento_id, pista_id, nombre, orden) values (tests.id('evento_a'), tests.id('pista1'), '{"es":"Bloque 2"}', 2) returning id into v;
  insert into pg_temp.escenario values ('bloque2', v);
  insert into public.orden_item (evento_id, pista_id, bloque_id, ficha_id, posicion)
  values (tests.id('evento_a'), tests.id('pista1'), tests.id('bloque1'), tests.id('ficha1'), 1) returning id into v;
  insert into pg_temp.escenario values ('item1', v);
  insert into public.orden_item (evento_id, pista_id, bloque_id, ficha_id, posicion)
  values (tests.id('evento_a'), tests.id('pista1'), tests.id('bloque1'), tests.id('ficha2'), 2) returning id into v;
  insert into pg_temp.escenario values ('item2', v);
end;
$$;

-- Cantidad de filas afectadas por una sentencia DML (las bloqueadas por RLS dan 0).
create or replace function tests.filas(p_sql text)
returns integer
language plpgsql
as $$
declare
  v integer;
begin
  execute p_sql;
  get diagnostics v = row_count;
  return v;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select ok(true, 'helpers de prueba instalados');
select * from finish();
rollback;
