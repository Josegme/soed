begin;
select plan(4);
select lives_ok($$ select tests.escenario() $$, 'el escenario base se crea');
select is((select count(*)::int from public.evento), 3, 'tres eventos');
select is((select numero from public.liquidacion where id = tests.id('liq1')), 'LIQ-SELA-0001', '[TR-15] primera liquidación del evento A');
select is((select numero from public.liquidacion where id = tests.id('liq2')), 'LIQ-SELA-0002', '[TR-15] correlativo sin huecos');
select * from finish();
rollback;
