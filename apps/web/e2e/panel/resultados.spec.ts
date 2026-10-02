import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sql } from './utilidades';

/** Certificados (OR-44, PR-32). Corre después de gestion.spec, que calcula los resultados. */
test.describe.configure({ mode: 'serial' });

const publicar = (si: boolean) =>
  sql(`update public.evento set resultados_publicados_at = ${si ? 'now()' : 'null'} where id = '${ids.evento_a}'`);

test.afterAll(() => publicar(false));

test.describe('[OR-44] [PR-32] certificados bilingües', () => {
  test('el organizador descarga los certificados en cada idioma', async ({ context }) => {
    await ingresarComo(context, 'org_a');
    for (const idioma of ['es', 'pt-BR']) {
      const r = await context.request.get(`/api/certificados/${ids.evento_a}?idioma=${idioma}`);
      expect(r.status()).toBe(200);
      expect(r.headers()['content-type']).toBe('application/pdf');
      expect(r.headers()['content-disposition']).toContain(`certificados-${idioma}.pdf`);
      expect((await r.body()).subarray(0, 4).toString()).toBe('%PDF');
    }
  });

  test('[OR-42] la academia no accede antes de la publicación (Art. 32)', async ({ context }) => {
    publicar(false);
    await ingresarComo(context, 'prof1');
    expect((await context.request.get(`/api/certificados/${ids.evento_a}?idioma=es`)).status()).toBe(404);
  });

  test('publicados, la academia descarga solo los suyos desde su panel', async ({ page, context }) => {
    publicar(true);
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia/eventos/sela');
    const enlace = page.getByRole('link', { name: 'En Português' });
    await expect(enlace).toBeVisible();
    const r = await context.request.get((await enlace.getAttribute('href')) ?? '');
    expect(r.status()).toBe(200);
    expect((await r.body()).subarray(0, 4).toString()).toBe('%PDF');
    // La ficha de otra academia no se filtra aunque se pida explícitamente.
    expect((await context.request.get(`/api/certificados/${ids.evento_a}?ficha=${ids.ficha2}`)).status()).toBe(404);
  });

  test('[PR-29] la academia ve sus resultados de la temporada en su panel', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto('/es/academia');
    const historial = page.getByRole('region', { name: 'Resultados de la temporada' });
    await expect(historial.getByRole('cell', { name: 'Solo de Ana' })).toBeVisible();
    await expect(historial.getByRole('cell', { name: 'Solo de Carla' })).toHaveCount(0);
  });

  test('sin sesión no hay certificados', async ({ context }) => {
    await context.clearCookies();
    expect((await context.request.get(`/api/certificados/${ids.evento_a}`)).status()).toBe(401);
  });
});
