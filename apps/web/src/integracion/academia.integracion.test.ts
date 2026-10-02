import { describe, expect, it } from 'vitest';
import { construirSesion } from '@/lib/auth/permisos';
import { inscripcionDeAcademia, listarCoreografias, reglamentoDeReferencia } from '@/modules/academias/infrastructure/consultas';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { revalidarFicha } from '@/modules/inscripciones/application/fichas';
import { puertosFichaSupabase } from '@/modules/inscripciones/infrastructure/puertos-ficha-supabase';
import { emitirLiquidacion, liquidacionPrevia } from '@/modules/liquidaciones/application/liquidaciones';
import { puertosLiquidacionSupabase } from '@/modules/liquidaciones/infrastructure/puertos-liquidacion-supabase';
import { clienteAnonimo, clienteDe, ids, sql } from './utilidades';

/*
 * Integración HTTP real: supabase-js → PostgREST 13 → PostgreSQL con las
 * migraciones y RLS de producción. Ejecutar con `pnpm test:integracion`.
 */

describe('[TR-36] sesión: roles y permisos leídos con RLS', () => {
  it('arma la sesión del profesor con su academia y sin permisos de evento', async () => {
    const s = await construirSesion(clienteDe('prof1'), { id: ids.prof1! });
    expect(s.academias.map((a) => a.id)).toEqual([ids.academia1]);
    expect(s.permisos.size).toBe(0);
    expect(s.esSuperAdmin).toBe(false);
  });
  it('arma la sesión del staff con los permisos de su rol en el evento A', async () => {
    const s = await construirSesion(clienteDe('staff_a'), { id: ids.staff_a! });
    expect([...(s.permisos.get(ids.evento_a!) ?? [])].sort()).toEqual(['acreditacion.operar', 'cobros.registrar', 'inscripciones.ver', 'liquidaciones.ver']);
  });
  it('reconoce al Super Admin', async () => {
    expect((await construirSesion(clienteDe('sa'), { id: ids.sa! })).esSuperAdmin).toBe(true);
  });
});

describe('[PU-03] [PU-07] API pública anónima', () => {
  it('lista eventos publicados con columnas públicas y reglamento', async () => {
    const eventos = await repositorioEventosPublicos().listarPublicados();
    expect(eventos.map((e) => e.slug).sort()).toEqual(['SELA', 'SELB']);
    expect(eventos.find((e) => e.slug === 'SELA')?.reglamento.categorias.length).toBeGreaterThan(0);
  });
  it('anon no puede leer columnas privadas del evento ni tablas operativas', async () => {
    const db = clienteAnonimo();
    expect((await db.from('evento').select('tarifario')).error?.code).toBe('42501');
    expect((await db.from('ficha').select('id')).error?.code).toBe('42501');
  });
  it('el orden público solo aparece al publicarlo', async () => {
    expect(await repositorioEventosPublicos().ordenPublico('SELA')).toEqual([]);
    sql(`update public.evento set orden_publicado_at = now() where id = '${ids.evento_a}'`);
    const filas = await repositorioEventosPublicos().ordenPublico('SELA');
    expect(filas.map((f) => f.coreografia)).toEqual(['Solo de Ana', 'Solo de Carla']);
  });
});

describe('[PR-10] [PR-12] [PR-13] [PR-15] flujo de la academia sobre PostgREST', () => {
  it('lee la inscripción con fichas, elenco, liquidación y orden embebidos (sin ambigüedad de FKs)', async () => {
    const db = clienteDe('prof1');
    const datos = await inscripcionDeAcademia(db, 'sela', ids.academia1!);
    expect(datos?.inscripcion?.id).toBe(ids.insc1);
    expect(datos?.fichas.map((f) => f.nombre)).toEqual(['Solo de Ana']);
    expect(datos?.fichas[0]?.elenco[0]?.nombre).toBe('Ana Uno');
    expect(datos?.liquidacion?.numero).toBe('LIQ-SELA-0001');
    expect(datos?.orden[0]?.bloque).not.toBeNull();
  });
  it('lee el catálogo de coreografías con elenco y el reglamento de referencia', async () => {
    const db = clienteDe('prof1');
    expect((await listarCoreografias(db, ids.academia1!)).map((c) => c.nombre).sort()).toEqual(['Solo de Ana', 'Solo de Bruno']);
    expect((await reglamentoDeReferencia(db))?.preset).toBe('encuentro-2026');
  });
  it('la academia crea una ficha y el servidor la valida con el dominio', async () => {
    const db = clienteDe('prof1');
    const { data: ficha, error } = await db
      .from('ficha')
      .insert({
        evento_id: ids.evento_a!,
        academia_id: ids.academia1!,
        inscripcion_id: ids.insc1!,
        coreografia_id: ids.coreo1b!,
        nombre: 'Solo de Bruno',
        genero: 'JAZZ',
        formacion: 'SOLO',
        musica_duracion_seg: 170,
      })
      .select('id, estado')
      .single();
    expect(error).toBeNull();
    expect(ficha?.estado).toBe('BORRADOR');
    await db.from('ficha_bailarin').insert({ ficha_id: ficha!.id, bailarin_id: ids.bailarin1b!, evento_id: ids.evento_a!, academia_id: ids.academia1!, nombre_mostrado: 'Bruno Uno' });

    const sesion = await construirSesion(db, { id: ids.prof1! });
    const r = await revalidarFicha(puertosFichaSupabase(db, sesion), ficha!.id);
    expect(r.ok && r.value.valida).toBe(true);
    const { data: guardada } = await db.from('ficha').select('categoria, validacion, ficha_bailarin (edad, categoria)').eq('id', ficha!.id).single();
    expect(guardada?.categoria).toBe('INFANTO_JUVENIL');
    expect(guardada?.ficha_bailarin[0]?.edad).toBeGreaterThan(10);
  });
  it('otra academia no puede validar ni leer esa ficha', async () => {
    const db = clienteDe('prof2');
    const sesion = await construirSesion(db, { id: ids.prof2! });
    const { data } = await clienteDe('prof1').from('ficha').select('id').eq('coreografia_id', ids.coreo1b!).single();
    expect(await revalidarFicha(puertosFichaSupabase(db, sesion), data!.id)).toMatchObject({ ok: false, error: { codigo: 'FICHA_INEXISTENTE' } });
  });
  it('calcula la liquidación en vivo y emite versiones con número correlativo', async () => {
    const db = clienteDe('prof1');
    const sesion = await construirSesion(db, { id: ids.prof1! });
    const puertos = puertosLiquidacionSupabase(db, sesion);
    const previa = await liquidacionPrevia(puertos, ids.insc1!);
    expect(previa.ok && previa.value.total).toBe(2 * 10000 + 2 * 5000);
    const emision = await emitirLiquidacion(puertos, ids.insc1!, 'pt-BR');
    expect(emision).toMatchObject({ ok: true, value: { numero: 'LIQ-SELA-0001', version: 2, totalCentavos: 15000, nueva: true } });
    expect(await emitirLiquidacion(puertos, ids.insc1!, 'pt-BR')).toMatchObject({ ok: true, value: { nueva: false } });
  });
});
