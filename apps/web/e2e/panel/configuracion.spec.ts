import { expect, test, type Page } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

test.describe.configure({ mode: 'serial' });

async function agregarCampo(
  page: Page,
  campo: { ambito: string; codigo: string; tipo: string; pregunta: string; opciones?: string; obligatorio?: boolean },
) {
  await page.goto(`/es/gestion/${ids.evento_a}/configuracion`);
  const seccion = page.getByRole('region', { name: 'Campos adicionales' });
  await seccion.getByText('Agregar campo').click();
  await seccion.getByRole('combobox', { name: 'Se pide' }).selectOption(campo.ambito);
  await seccion.getByRole('textbox', { name: /^Código/ }).fill(campo.codigo);
  await seccion.getByRole('combobox', { name: 'Tipo' }).selectOption(campo.tipo);
  await seccion.getByRole('textbox', { name: 'Pregunta (Español)' }).fill(campo.pregunta);
  if (campo.opciones) await seccion.getByRole('textbox', { name: /^Opciones/ }).fill(campo.opciones);
  if (campo.obligatorio) await seccion.getByRole('checkbox', { name: 'Obligatorio' }).check();
  await seccion.getByRole('button', { name: 'Agregar' }).click();
  await expect(seccion.getByText(campo.pregunta, { exact: true })).toBeVisible();
}

test.describe('[OR-16] [PR-18] campos adicionales', () => {
  test('el organizador define campos de inscripción y de ficha', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await agregarCampo(page, {
      ambito: 'inscripcion',
      codigo: 'contacto_emergencia',
      tipo: 'TEXTO',
      pregunta: 'Contacto de emergencia',
      obligatorio: true,
    });
    await agregarCampo(page, { ambito: 'ficha', codigo: 'talle', tipo: 'OPCION', pregunta: 'Talle de remera', opciones: 'S, M, L' });
    expect(sql(`select jsonb_array_length(campos_adicionales->'ficha') from public.evento where id = '${ids.evento_a}'`)).toBe('1');
    await sinViolacionesA11y(page);
  });

  test('la academia los completa y el organizador los ve en la ficha', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/eventos/sela');
    const datos = page.getByRole('region', { name: 'Datos que pide el evento' });
    await datos.getByRole('textbox', { name: /Contacto de emergencia/ }).fill('Marta · 555-1234');
    await datos.getByRole('button', { name: 'Guardar' }).click();
    await expect(datos.getByRole('status').filter({ hasText: 'Datos guardados.' })).toBeVisible();

    const ficha = page.getByRole('listitem').filter({ hasText: 'Solo de Ana' }).first();
    await ficha.getByText('Datos adicionales').click();
    await ficha.getByRole('combobox', { name: 'Talle de remera' }).selectOption('M');
    await ficha.getByRole('button', { name: 'Guardar' }).click();
    await expect(ficha.getByRole('status').filter({ hasText: 'Datos guardados.' })).toBeVisible();
    await sinViolacionesA11y(page);

    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/inscripciones`);
    await expect(page.getByText('Talle de remera: M')).toBeVisible();
  });
});

test.describe('[OR-15] [OR-18] acreditación y traducciones', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'org_a'));

  test('zonas por tipo y horario de la mesa, visibles en acreditación', async ({ page, context }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/configuracion`);
    const seccion = page.getByRole('region', { name: 'Acreditación' });
    await seccion.getByLabel('Apertura de la mesa').fill('2027-05-01T08:00');
    await seccion.getByLabel('Cierre de la mesa').fill('2027-05-01T20:00');
    await seccion.getByRole('textbox', { name: /Zonas · Bailarín/ }).fill('Camarines, Escenario, camarines');
    await seccion.getByRole('button', { name: 'Guardar' }).click();
    await expect(seccion.getByRole('status').filter({ hasText: 'Acreditación guardada.' })).toBeVisible();
    expect(sql(`select acreditacion->'zonasPorTipo'->'BAILARIN' from public.evento where id = '${ids.evento_a}'`)).toBe(
      '["Camarines", "Escenario"]',
    );

    await ingresarComo(context, 'staff_a');
    await page.goto(`/es/acreditacion/${ids.evento_a}`);
    await expect(page.getByText(/Mesa abierta de .* a /)).toBeVisible();
  });

  test('lista el contenido escrito en un idioma y no en el otro', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/configuracion`);
    const seccion = page.getByRole('region', { name: 'Traducciones pendientes' });
    await expect(seccion.getByRole('listitem').filter({ hasText: 'Nombre del evento' })).toContainText('Falta Português');
  });
});
