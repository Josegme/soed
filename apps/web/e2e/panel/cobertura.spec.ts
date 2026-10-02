import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sql } from './utilidades';

/**
 * Funcionalidades ya implementadas que no tenían prueba propia. Usa el
 * Selectivo B (org_b) para no alterar criterios ni pistas del Selectivo A,
 * de los que dependen las pruebas del jurado y del vivo.
 */
test.describe.configure({ mode: 'serial' });

test.describe('[OR-11] [OR-13] [OR-14] configuración del orden y los criterios', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'org_b'));

  test('crea una pista y un bloque con horario', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_b}/orden`);
    await page.getByText('Nueva pista').click();
    const pista = page.locator('details', { hasText: 'Nueva pista' });
    await pista.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Escenario principal');
    await pista.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { name: 'Escenario principal' })).toBeVisible();

    await page.getByText('Nuevo bloque').first().click();
    const bloque = page.locator('details', { hasText: 'Nuevo bloque' }).first();
    await bloque.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Mañana');
    await bloque.getByLabel('Inicio programado').fill('2027-06-01T09:30');
    await bloque.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { name: 'Mañana' })).toBeVisible();
    expect(sql(`select count(*) from public.bloque where evento_id = '${ids.evento_b}' and inicio_programado is not null`)).toBe('1');
  });

  test('define un criterio de evaluación con peso', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_b}/puntajes`);
    await page.getByText('Agregar criterio').click();
    const criterio = page.locator('details', { hasText: 'Agregar criterio' });
    await criterio.getByRole('textbox', { name: /^Código/ }).fill('PUESTA');
    await criterio.getByRole('textbox', { name: 'Peso' }).fill('1,5');
    await criterio.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Puesta en escena');
    await criterio.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Criterio guardado.' })).toBeVisible();
    expect(Number(sql(`select peso from public.criterio where evento_id = '${ids.evento_b}' and codigo = 'PUESTA'`))).toBe(1.5);
  });
});

test.describe('[OR-04] [OR-07] [OR-24] [SA-06] gestión del evento', () => {
  test('datos de pago que ve la academia en la liquidación', async ({ page, context }) => {
    await ingresarComo(context, 'org_b');
    await page.goto(`/es/gestion/${ids.evento_b}/configuracion`);
    const cobranza = page.getByRole('region', { name: 'Cobranza' });
    await cobranza.getByRole('textbox', { name: 'Datos para pagar (Español)' }).fill('Alias: SELECTIVO.B');
    await cobranza.getByRole('button', { name: 'Guardar' }).click();
    await expect(cobranza.getByRole('status')).toBeVisible();
    expect(sql(`select datos_pago->>'es' from public.evento where id = '${ids.evento_b}'`)).toBe('Alias: SELECTIVO.B');
  });

  test('guardar el reglamento del evento lo versiona', async ({ page, context }) => {
    await ingresarComo(context, 'org_b');
    const antes = Number(sql(`select reglamento_version from public.evento where id = '${ids.evento_b}'`));
    await page.goto(`/es/gestion/${ids.evento_b}/configuracion`);
    const seccion = page.getByRole('region', { name: /Reglamento/ });
    const json = JSON.parse(await seccion.getByRole('textbox').inputValue());
    json.formaciones[0].toleranciaTiempoSeg += 5;
    await seccion.getByRole('textbox').fill(JSON.stringify(json, null, 2));
    await seccion.getByRole('button', { name: /Guardar/ }).click();
    await expect(seccion.getByRole('status')).toBeVisible();
    expect(Number(sql(`select reglamento_version from public.evento where id = '${ids.evento_b}'`))).toBe(antes + 1);
  });

  test('resuelve la solicitud de modificación de una academia', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/inscripciones`);
    const solicitud = page.getByRole('listitem').filter({ hasText: 'Cambiar la música por la versión editada' });
    await solicitud.getByRole('textbox', { name: 'Respuesta para la academia (opcional)' }).fill('Aprobado: subí la nueva versión.');
    await solicitud.getByRole('button', { name: 'Aprobar solicitud' }).click();
    // Resuelta, la tarjeta deja de ofrecer el formulario y muestra la respuesta.
    await expect(solicitud.getByText('Aprobado: subí la nueva versión.')).toBeVisible();
    await expect(solicitud.getByRole('button', { name: 'Aprobar solicitud' })).toHaveCount(0);
    expect(sql(`select estado || '|' || respuesta from public.solicitud_modificacion where evento_id = '${ids.evento_a}'`)).toBe(
      'APROBADA|Aprobado: subí la nueva versión.',
    );
  });

  test('suma y revoca el acceso de un miembro del equipo', async ({ page, context }) => {
    await ingresarComo(context, 'org_b');
    await page.goto(`/es/gestion/${ids.evento_b}/equipo`);
    await page.getByRole('textbox', { name: /Email de la cuenta/ }).fill('loc_a@test.soed');
    await page.getByRole('combobox', { name: 'Rol' }).selectOption('LOCUTOR');
    await page.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Persona agregada al equipo.' })).toBeVisible();
    const fila = page.getByRole('row', { name: /Loc A/ });
    await fila.getByRole('button', { name: 'Quitar' }).click();
    await expect(fila).toHaveCount(0);
    expect(
      sql(`select count(*) from public.evento_miembro where evento_id = '${ids.evento_b}' and usuario_id = '${ids.loc_a}' and activo`),
    ).toBe('0');
  });
});

test.describe('[PR-06] [PR-07] [PR-09] [PR-11] [PR-14] la academia', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'prof1'));

  test('da de baja y reactiva un bailarín', async ({ page }) => {
    await page.goto('/es/academia/bailarines');
    const fila = page.getByRole('row', { name: /Uno, Bruno/ });
    await fila.getByRole('button', { name: 'Dar de baja' }).click();
    await expect(fila.getByText('Inactivo')).toBeVisible();
    await fila.getByRole('button', { name: 'Reactivar' }).click();
    await expect(fila.getByText('Inactivo')).toHaveCount(0);
  });

  test('crea una coreografía reutilizable con su elenco', async ({ page }) => {
    await page.goto('/es/academia/coreografias');
    await page.getByRole('textbox', { name: /Nombre de la coreografía/ }).fill('Dúo de prueba');
    await page.getByRole('combobox', { name: /Género/ }).selectOption({ index: 1 });
    await page.getByRole('combobox', { name: /Formación/ }).selectOption('DUO');
    await page.getByRole('checkbox', { name: /Ana/ }).first().check();
    await page.getByRole('checkbox', { name: /Bruno/ }).first().check();
    await page
      .getByRole('button', { name: /Guardar|Crear/ })
      .first()
      .click();
    await expect(page.getByRole('status').filter({ hasText: 'Coreografía guardada.' })).toBeVisible();
    expect(
      sql(
        `select count(*) from public.coreografia_bailarin cb join public.coreografia c on c.id = cb.coreografia_id where c.nombre = 'Dúo de prueba'`,
      ),
    ).toBe('2');
  });

  test('inscribe la academia en otro evento y ve la categoría calculada de su elenco', async ({ page }) => {
    await page.goto('/es/academia/eventos/selb');
    await page.getByRole('button', { name: 'Inscribir a mi academia en este evento' }).click();
    await expect(
      page.getByText('Tu academia está inscripta en este evento.').or(page.getByRole('heading', { name: 'Fichas' })),
    ).toBeVisible();
    expect(sql(`select count(*) from public.inscripcion where evento_id = '${ids.evento_b}' and academia_id = '${ids.academia1}'`)).toBe(
      '1',
    );

    // [PR-11] En la ficha enviada del Selectivo A, cada integrante muestra edad y categoría a la fecha del evento.
    await page.goto('/es/academia/eventos/sela');
    const ficha = page.getByRole('listitem').filter({ hasText: 'Solo de Ana' }).first();
    await ficha.locator('details').first().click();
    await expect(ficha.getByText(/\d+ años/).first()).toBeVisible();
  });

  test('elige rubros opcionales y la liquidación previa los suma', async ({ page }) => {
    sql(
      `update public.evento set tarifario = '{"moneda":"BRL","porCoreografia":{"precioBase":10000},"rubros":[{"codigo":"REMERA","nombre":{"es":"Remera del evento"},"precioUnitario":2500}]}' where id = '${ids.evento_a}'`,
    );
    await page.goto('/es/academia/eventos/sela');
    await page.getByRole('spinbutton', { name: /Remera del evento/ }).fill('2');
    await page.getByRole('button', { name: 'Guardar rubros' }).click();
    await expect(page.getByText('Remera del evento').first()).toBeVisible();
    expect(sql(`select rubros::text from public.inscripcion where id = '${ids.insc1}'`)).toContain('"cantidad": 2');
  });
});
