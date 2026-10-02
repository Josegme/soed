-- Fixture persistente para pruebas de integración HTTP (PostgREST): crea el
-- escenario base y guarda sus ids en tests.ids (fuera de transacción).
select tests.escenario();
create table if not exists tests.ids (clave text primary key, id uuid not null);
insert into tests.ids select clave, id from pg_temp.escenario on conflict (clave) do update set id = excluded.id;
grant select on tests.ids to anon, authenticated, service_role;
-- Tarifario para probar la emisión de liquidaciones.
update public.evento set tarifario = '{"moneda":"BRL","porBailarin":{"precio":10000},"porCoreografia":{"precioBase":5000}}'
 where id = tests.id('evento_a');
