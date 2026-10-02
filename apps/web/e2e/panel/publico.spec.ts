import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

/**
 * Sitio público con datos reales (rol anon contra PostgREST). Corre después de
 * gestion.spec, que calcula los resultados del Selectivo A.
 */
test.describe.configure({ mode: 'serial' });

test.afterAll(() => {
  sql(`update public.evento set orden_publicado_at = null, resultados_publicados_at = null where id = '${ids.evento_a}'`);
});

test.describe('[PU-03] [PU-04] [PU-05] [PU-06] evento público', () => {
  test('listado, detalle con cronograma y bases', async ({ page }) => {
    await page.goto('/es/eventos');
    await page
      .getByRole('link', { name: /Selectivo A/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/es\/eventos\/sela$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Selectivo A');
    const cronograma = page.getByRole('region', { name: 'Cronograma' });
    await expect(cronograma.getByText('Bloque 1')).toBeVisible();
    await expect(cronograma.getByText('Pista 1')).toBeVisible();
    await expect(cronograma.locator('time')).toHaveText(/^\d{2}:\d{2}$/);
    await expect(page.getByRole('heading', { name: 'Bases y condiciones' })).toBeVisible();
    // Sin publicación no hay enlaces al orden ni a los resultados (Art. 32).
    await expect(page.getByRole('link', { name: 'Orden de salida' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Resultados' })).toHaveCount(0);
    await sinViolacionesA11y(page);
  });

  test('[TR-20] el detalle en portugués @movil', async ({ page }) => {
    await page.goto('/pt/eventos/sela');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('heading', { name: 'Cronograma' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Regulamento' })).toBeVisible();
    await sinViolacionesA11y(page);
  });
});

test.describe('[OR-40] orden del día imprimible', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'org_a'));

  test('en el idioma elegido, con horario estimado', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/orden`);
    await page.getByRole('link', { name: 'Orden del día imprimible' }).click();
    await expect(page).toHaveURL(new RegExp(`/es/gestion/${ids.evento_a}/orden/imprimir$`));
    await expect(page.getByRole('heading', { name: 'Orden del día' })).toBeVisible();
    const tabla = page.getByRole('table', { name: /Pista 1 · Bloque 1/ });
    await expect(tabla.getByRole('columnheader', { name: 'Hora est.' })).toBeVisible();
    await expect(tabla.getByRole('cell', { name: /Solo de (Ana|Carla)/ }).first()).toBeVisible();
    await expect(tabla.getByRole('cell', { name: /^\d{2}:\d{2}$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir o guardar PDF' })).toBeVisible();
    await sinViolacionesA11y(page);

    await page.getByRole('link', { name: 'Português' }).click();
    await expect(page).toHaveURL(new RegExp(`/pt/gestion/${ids.evento_a}/orden/imprimir$`));
    await expect(page.getByRole('heading', { name: 'Ordem do dia' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Português' })).toHaveAttribute('aria-current', 'page');
  });

  test('la impresión oculta la navegación del panel', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/orden/imprimir`);
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('navigation', { name: 'Secciones del evento' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Imprimir o guardar PDF' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Orden del día' })).toBeVisible();
  });
});

test.describe('[PU-07] [PU-08] publicación del orden y los resultados', () => {
  test('el organizador publica y el público ve orden y ranking sin datos personales', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/orden`);
    await page.getByRole('button', { name: 'Publicar orden' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Orden publicado.' })).toBeVisible();
    await page.goto(`/es/gestion/${ids.evento_a}/puntajes`);
    await page.getByRole('button', { name: 'Publicar resultados' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Resultados publicados.' })).toBeVisible();

    await context.clearCookies();
    await page.goto('/es/eventos/sela');
    await page.getByRole('link', { name: 'Orden de salida' }).click();
    await expect(page).toHaveURL(/\/es\/eventos\/sela\/orden$/);
    await expect(page.getByText(/Solo de (Ana|Carla)/).first()).toBeVisible();
    await expect(page.getByText('Academia Uno').first()).toBeVisible();
    await sinViolacionesA11y(page);

    await page.goto('/es/eventos/sela/resultados');
    await expect(page.getByText('Solo de Ana').first()).toBeVisible();
    await sinViolacionesA11y(page);
  });
});

test.describe('[PU-12] [PU-14] SEO y PWA', () => {
  test('manifest, sitemap con hreflang y robots fuera de producción', async ({ request }) => {
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest).toMatchObject({ display: 'standalone', start_url: '/es/panel' });
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('/es/eventos/sela</loc>');
    expect(sitemap).toMatch(/hreflang="pt-BR"[^>]*href="[^"]*\/pt\/eventos\/sela"/);
    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /');
  });

  test('el service worker precachea la página sin conexión de cada idioma', async ({ page }) => {
    await page.goto('/es/eventos');
    const cacheadas = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const claves = await caches.keys();
      const cache = await caches.open(claves.find((k) => k.startsWith('soed-shell-')) ?? '');
      return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
    });
    expect(cacheadas).toEqual(['/es/sin-conexion', '/pt/sin-conexion']);
    await page.goto('/pt/sin-conexion');
    await expect(page.getByRole('heading', { name: 'Sem conexão' })).toBeVisible();
    await sinViolacionesA11y(page);
  });
});
