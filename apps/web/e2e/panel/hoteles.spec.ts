import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y } from './utilidades';

test.describe.configure({ mode: 'serial' });

test.describe('[OR-09] [OR-54] [PR-30] hoteles y paquetes', () => {
  test('el organizador crea un hotel con cupo y criterio de prioridad', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/hoteles`);
    await expect(page.getByText('Todavía no hay hoteles ni paquetes.')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre' }).fill('Hotel Centro');
    await page.getByRole('spinbutton', { name: /Cupo/ }).fill('2');
    await page.getByRole('textbox', { name: /Precio por plaza/ }).fill('150');
    await page.getByRole('combobox', { name: 'Prioridad' }).selectOption('PRIMER_PAGO');
    await page.getByRole('button', { name: 'Crear' }).click();
    // Al crear el primero, el formulario se repliega y la tarjeta del hotel es la confirmación.
    await expect(page.getByRole('heading', { name: 'Hotel Centro' })).toBeVisible();
    await expect(page.getByText('0 de 2 plazas asignadas · 0 solicitadas')).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('la academia pide más plazas que el cupo y ve su lista de espera', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/eventos/sela');
    const seccion = page.getByRole('region', { name: 'Hotel y paquetes' });
    await expect(seccion.getByText('Hotel Centro')).toBeVisible();
    await seccion.getByRole('spinbutton', { name: 'Plazas' }).fill('3');
    await seccion.getByRole('button', { name: 'Solicitar' }).click();
    await expect(seccion.getByText('Pediste 3 plazas: 2 con lugar hoy y 1 en lista de espera.')).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('el organizador ve la prioridad y la asignación vigente', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/hoteles`);
    await expect(page.getByText('2 de 2 plazas asignadas · 3 solicitadas')).toBeVisible();
    const fila = page.getByRole('row', { name: /Academia Uno/ });
    await expect(fila.getByRole('cell').nth(0)).toHaveText('1');
    await expect(fila.getByRole('cell').nth(3)).toHaveText('2');
    await expect(fila.getByRole('cell').nth(4)).toHaveText('1');
    await expect(page.getByText('Más pedidos que cupo')).toBeVisible();
  });
});
