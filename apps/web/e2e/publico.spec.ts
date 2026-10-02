import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const RUTAS = ['/es', '/pt', '/es/eventos', '/pt/eventos', '/es/ingresar', '/pt/registro', '/es/legal/privacidad'];

test.describe('[PU-01] rutas por idioma', () => {
  test('la raíz redirige al idioma por defecto', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/es$/);
  });

  test('/es y /pt sirven el documento en su idioma', async ({ page }) => {
    await page.goto('/es');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Del ensayo al escenario');
    await page.goto('/pt');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Do ensaio ao palco');
  });

  test('el selector de idioma conserva la página', async ({ page }) => {
    await page.goto('/es/eventos');
    await page.getByRole('combobox', { name: /cambiar idioma/i }).selectOption('pt-BR');
    await expect(page).toHaveURL(/\/pt\/eventos$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
  });

  test('una ruta inexistente responde 404', async ({ page }) => {
    const r = await page.goto('/es/no-existe');
    expect(r?.status()).toBe(404);
  });
});

test.describe('[PU-02] [TR-38] marca de la instancia', () => {
  test('muestra el logo y el nombre del cliente', async ({ page }) => {
    await page.goto('/es');
    await expect(page.getByRole('img', { name: 'Encuentro de Danzas' }).first()).toBeVisible();
  });
});

test.describe('[TR-35] headers de seguridad', () => {
  test('CSP, HSTS, nosniff y frame-ancestors', async ({ request }) => {
    const r = await request.get('/es');
    const h = r.headers();
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['strict-transport-security']).toContain('max-age=');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-powered-by']).toBeUndefined();
  });
});

test.describe('[PU-13] accesibilidad WCAG 2.2 AA', () => {
  for (const ruta of RUTAS) {
    test(`sin violaciones en ${ruta}`, async ({ page }) => {
      await page.goto(ruta);
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test('el salto al contenido es el primer foco', async ({ page }) => {
    await page.goto('/es');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  });
});

test.describe('[PU-15] formularios de acceso', () => {
  test('el registro valida en el servidor y conserva los datos', async ({ page }) => {
    await page.goto('/es/registro');
    await page.getByLabel('Tu nombre').fill('Ana');
    await page.getByRole('textbox', { name: /^Email/ }).fill('no-es-email');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Ingresá un email válido.')).toBeVisible();
    await expect(page.getByLabel('Tu nombre')).toHaveValue('Ana');
  });
});

test.describe('[PU-11] textos legales por cliente', () => {
  test('términos y privacidad en cada idioma, con contacto mientras falte el texto', async ({ page }) => {
    await page.goto('/es/legal/terminos');
    await expect(page.getByRole('heading', { level: 1, name: 'Términos y condiciones' })).toBeVisible();
    await expect(page.getByText(/escribinos a .+@.+/)).toBeVisible();
    await page.goto('/pt/legal/privacidad');
    await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidade' })).toBeVisible();
    expect((await page.goto('/es/legal/otro'))?.status()).toBe(404);
  });
});
