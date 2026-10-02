-- Datos adicionales para el e2e del panel (sobre tests/integracion/fixture.sql):
-- cobros, planillas enviadas y una solicitud pendiente, para que cada pantalla
-- tenga contenido real. Corre como postgres (las guardas de usuario final no aplican).
-- tests.id() lee pg_temp.escenario: se reconstruye desde tests.ids en esta sesión.
create temp table escenario as select clave, id from tests.ids;
update public.perfil set nombre = initcap(replace(split_part(email, '@', 1), '_', ' ')) where email like '%@test.soed';

insert into public.cobro (evento_id, academia_id, liquidacion_id, monto_centavos, moneda, medio, client_uuid, registrado_por, referencia)
values (tests.id('evento_a'), tests.id('academia1'), tests.id('liq1'), 4000, 'BRL', 'PIX', gen_random_uuid(), tests.id('staff_a'), 'PIX 12345');

insert into public.planilla (id, evento_id, academia_id, ficha_id, jurado_id, estado)
values
  ('e2e00000-0000-4000-8000-000000000001', tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1'), tests.id('jur1_a'), 'BORRADOR'),
  ('e2e00000-0000-4000-8000-000000000002', tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1'), tests.id('jur2_a'), 'BORRADOR');
insert into public.planilla_nota (planilla_id, criterio_id, evento_id, valor) values
  ('e2e00000-0000-4000-8000-000000000001', tests.id('crit_tec'), tests.id('evento_a'), 9.5),
  ('e2e00000-0000-4000-8000-000000000001', tests.id('crit_int'), tests.id('evento_a'), 9),
  ('e2e00000-0000-4000-8000-000000000002', tests.id('crit_tec'), tests.id('evento_a'), 6),
  ('e2e00000-0000-4000-8000-000000000002', tests.id('crit_int'), tests.id('evento_a'), 7);
update public.planilla set estado = 'ENVIADA', enviada_at = now() where id::text like 'e2e00000%';
update public.evento set config_operacion = '{"juradosPorFicha":2,"intervaloSegundos":60,"duracionPorDefectoSegundos":240}' where id = tests.id('evento_a');
update public.bloque set inicio_programado = (current_date + 60)::timestamptz + interval '13 hours' where id = tests.id('bloque1');

insert into public.solicitud_modificacion (evento_id, academia_id, ficha_id, descripcion, creado_por)
values (tests.id('evento_a'), tests.id('academia1'), tests.id('ficha1'), 'Cambiar la música por la versión editada de 2:50.', tests.id('prof1'));

-- Música cargada en las dos fichas del Selectivo A (contenido sintético en el doble de storage).
update public.ficha set musica_path = academia_id || '/' || coreografia_id || '/musica.mp3'
 where id in (tests.id('ficha1'), tests.id('ficha2'));
