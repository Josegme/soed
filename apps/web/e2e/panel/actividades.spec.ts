import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

test.describe.configure({ mode: 'serial' });

const reservas = (tabla: string) => Number(sql(`select count(*) from public.${tabla} where evento_id = '${ids.evento_a}'`));

test.describe('[OR-51] [OR-52] [OR-53] [PU-09] [PU-10] [PR-31] [TR-34] clases y entradas', () => {
  test('el organizador publica una clase y un tipo de entrada', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/actividades`);
    await page.getByText('Agregar clase').click();
    const clase = page.locator('details', { hasText: 'Agregar clase' });
    await clase.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Jazz intermedio');
    await clase.getByRole('textbox', { name: 'Docente' }).fill('Marina Paz');
    await clase.getByLabel('Inicio').fill('2027-05-01T10:00');
    await clase.getByLabel('Fin').fill('2027-05-01T11:30');
    await clase.getByRole('spinbutton', { name: 'Cupo' }).fill('2');
    await clase.getByRole('textbox', { name: /Precio/ }).fill('80');
    await clase.getByRole('checkbox', { name: 'Publicar en el sitio' }).check();
    await clase.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { name: 'Jazz intermedio' })).toBeVisible();

    await page.getByText('Agregar tipo de entrada').click();
    const entrada = page.locator('details', { hasText: 'Agregar tipo de entrada' });
    await entrada.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Platea');
    await entrada.getByRole('spinbutton', { name: 'Cupo' }).fill('5');
    await entrada.getByRole('textbox', { name: /Precio/ }).fill('30');
    await entrada.getByRole('checkbox', { name: 'Publicar en el sitio' }).check();
    await entrada.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('heading', { name: 'Platea' })).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('el público reserva entradas sin cuenta y recibe el código por email', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/es/eventos/sela');
    await page.getByRole('link', { name: 'Entradas' }).click();
    await expect(page).toHaveURL(/\/es\/eventos\/sela\/entradas$/);
    await expect(page.getByText('5 lugares')).toBeVisible();
    await page.getByRole('textbox', { name: 'Nombre y apellido' }).fill('Lucía Prado');
    await page.getByRole('textbox', { name: 'Email' }).fill('lucia@example.com');
    await page.getByRole('spinbutton', { name: 'Cantidad' }).fill('2');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Tu código de reserva es [A-Z0-9]{10}/ })).toBeVisible();
    expect(sql(`select count(*) from public.email_envio where plantilla = 'reserva_recibida' and destinatario = 'lucia@example.com'`)).toBe(
      '1',
    );
    await sinViolacionesA11y(page);
  });

  test('un bot que completa el campo trampa no reserva', async ({ page, context }) => {
    await context.clearCookies();
    const antes = reservas('reserva_entrada');
    await page.goto('/es/eventos/sela/entradas');
    await page.getByRole('textbox', { name: 'Nombre y apellido' }).fill('Bot');
    await page.getByRole('textbox', { name: 'Email' }).fill('bot@example.com');
    await page.locator('input[name="sitio_web"]').fill('https://spam.example', { force: true });
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('status').filter({ hasText: /código de reserva/ })).toBeVisible();
    expect(reservas('reserva_entrada')).toBe(antes);
  });

  test('la academia reserva la clase para su bailarina y el cupo se agota', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/es/eventos/sela/clases');
    await page.getByRole('textbox', { name: 'Nombre y apellido' }).fill('Pedro Gómez');
    await page.getByRole('textbox', { name: 'Email' }).fill('pedro@example.com');
    await page.getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByRole('status').filter({ hasText: /código de reserva/ })).toBeVisible();

    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/eventos/sela');
    const seccion = page.getByRole('region', { name: 'Clases del evento' });
    await expect(seccion.getByText('1 lugar')).toBeVisible();
    await seccion.getByRole('textbox', { name: 'Nombre del bailarín' }).fill('Ana Uno');
    await seccion.getByRole('button', { name: 'Reservar lugar' }).click();
    await expect(seccion.getByText('Ana Uno')).toBeVisible();
    await expect(seccion.getByText('Agotada')).toBeVisible();
    await sinViolacionesA11y(page);

    await context.clearCookies();
    await page.goto('/es/eventos/sela/clases');
    await expect(page.getByText('Agotada')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reservar' })).toHaveCount(0);
  });

  test('la caja registra el pago manual de una reserva', async ({ page, context }) => {
    await ingresarComo(context, 'staff_a');
    await page.goto(`/es/gestion/${ids.evento_a}/actividades`);
    const fila = page.getByRole('row', { name: /Lucía Prado/ });
    await expect(fila.getByText('Pago pendiente')).toBeVisible();
    await fila.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.getByRole('row', { name: /Lucía Prado/ }).getByText('Pagada')).toBeVisible();
    expect(sql(`select count(*) from public.reserva_entrada where pagada and cobrado_por = '${ids.staff_a}'`)).toBe('1');
    // El staff cobra pero no configura el catálogo.
    await expect(page.getByText('Agregar clase')).toHaveCount(0);
  });
});
