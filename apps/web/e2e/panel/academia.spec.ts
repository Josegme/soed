import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

test.describe.configure({ mode: 'serial' });

const PANTALLAS = [
  '/es/academia',
  '/es/academia/bailarines',
  '/es/academia/coreografias',
  '/es/academia/perfil',
  '/es/academia/eventos/sela',
  '/pt/academia',
];

test.describe('[PU-13] [PR-03] panel de la academia', () => {
  for (const ruta of PANTALLAS) {
    test(`accesibilidad de ${ruta}`, async ({ page, context }, info) => {
      await ingresarComo(context, 'prof1');
      await page.goto(ruta);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await sinViolacionesA11y(page);
      await page.screenshot({ path: info.outputPath(`${ruta.replaceAll('/', '_')}.png`), fullPage: true });
    });
  }

  test('[PR-12] [PR-13] la inscripción muestra validación, liquidación en vivo y PDF', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/eventos/sela');
    await expect(page.getByText('Solo de Ana').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute(
      'href',
      new RegExp(`/api/liquidaciones/${ids.liq1}/pdf`),
    );
  });
});

test.describe('[PR-04] invitación de profesores', () => {
  let token = '';

  test('la titular invita por email y queda pendiente', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/perfil');
    await page.getByRole('textbox', { name: /Email del profesor/ }).fill('prof2@test.soed');
    await page.getByRole('button', { name: 'Invitar' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Invitación enviada.' })).toBeVisible();
    await expect(page.getByText('prof2@test.soed')).toBeVisible();
    token = sql(`select token from public.academia_invitacion where email = 'prof2@test.soed' and aceptada_at is null`);
    expect(
      sql(
        `select estado || '|' || idioma from public.email_envio where plantilla = 'invitacion_academia' and destinatario = 'prof2@test.soed'`,
      ),
    ).toBe('SIMULADO|es');
  });

  test('sin sesión, el enlace pide ingresar y vuelve a la invitación', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto(`/es/invitacion/${token}`);
    await expect(page).toHaveURL(new RegExp(`/es/ingresar\\?siguiente=%2Finvitacion%2F${token}`));
    await expect(page.locator('input[name="siguiente"]').first()).toHaveValue(`/invitacion/${token}`);
  });

  test('otra cuenta no puede usarla', async ({ page, context }) => {
    await ingresarComo(context, 'dj_a');
    await page.goto(`/es/invitacion/${token}`);
    await page.getByRole('button', { name: 'Aceptar y entrar' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Ingresaste con otra cuenta/ })).toBeVisible();
  });

  test('el invitado acepta y entra a la academia', async ({ page, context }) => {
    await ingresarComo(context, 'prof2');
    await page.goto(`/es/invitacion/${token}`);
    await sinViolacionesA11y(page);
    await page.getByRole('button', { name: 'Aceptar y entrar' }).click();
    await expect(page).toHaveURL(new RegExp(`/es/academia\\?a=${ids.academia1}`));
    expect(sql(`select rol from public.academia_miembro where academia_id = '${ids.academia1}' and usuario_id = '${ids.prof2}'`)).toBe(
      'PROFESOR',
    );
  });
});
