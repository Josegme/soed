import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

/** Tablero de temporada del Super Admin. Corre después de gestion.spec (resultados calculados). */
test.describe('[SA-10] [SA-11] [SA-15] [SA-18] tablero de temporada', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'sa'));

  test('participación y cobranza por evento, separadas por moneda', async ({ page }) => {
    await page.goto('/es/admin');
    await page.getByRole('link', { name: 'Tablero · Temporada 2027' }).click();
    await expect(page).toHaveURL(new RegExp(`/es/admin/temporadas/${ids.temporada}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Temporada 2027');
    await expect(page.getByText('Cobrado en BRL')).toBeVisible();
    const fila = page.getByRole('row', { name: /Selectivo A/ });
    await expect(fila).toBeVisible();
    await expect(fila.getByRole('cell').nth(2)).toHaveText(/^[1-9]\d*$/);
    await expect(page.getByRole('row', { name: /Selectivo B/ })).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('historial de resultados con filtro por academia o coreografía', async ({ page }) => {
    await page.goto(`/es/admin/temporadas/${ids.temporada}`);
    await page.getByRole('link', { name: 'Historial', exact: true }).click();
    await expect(page.getByRole('cell', { name: 'Solo de Ana' }).first()).toBeVisible();
    await sinViolacionesA11y(page);
    await page.getByRole('textbox', { name: 'Buscar' }).fill('inexistente');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page).toHaveURL(/q=inexistente/);
    await expect(page.getByText('Sin resultados para mostrar.')).toBeVisible();
  });

  test('exporta la temporada en CSV y queda constancia', async ({ context }) => {
    const r = await context.request.get(`/api/admin/temporadas/${ids.temporada}/exportar/eventos?idioma=es`);
    expect(r.status()).toBe(200);
    const texto = (await r.body()).toString('utf8');
    expect(texto.startsWith('﻿Evento;Nombre del evento;Estado')).toBe(true);
    expect(texto).toContain('SELA;Selectivo A');
    expect(texto).toContain(';BRL;');
    expect(
      Number(
        sql(
          `select count(*) from public.auditoria where tabla = 'exportacion' and registro_id like 'temporada:%' and usuario_id = '${ids.sa}'`,
        ),
      ),
    ).toBeGreaterThan(0);
  });

  test('[SA-07] [TR-11] crea una versión nueva del reglamento desde el preset', async ({ page }) => {
    const antes = Number(sql(`select max(version) from public.reglamento where preset = 'encuentro-2026'`));
    const versionEvento = sql(`select reglamento_version from public.evento where id = '${ids.evento_a}'`);
    await page.goto(`/es/admin/temporadas/${ids.temporada}`);
    await page.getByRole('link', { name: 'Reglamento', exact: true }).click();
    await page.getByRole('button', { name: 'Nueva versión desde el preset original' }).click();
    await expect(page.getByRole('status').filter({ hasText: `Se creó la versión ${antes + 1} y es la vigente.` })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(`^${antes + 1} .*Vigente`) })).toBeVisible();
    // Los eventos ya creados conservan su copia del reglamento.
    expect(sql(`select reglamento_version from public.evento where id = '${ids.evento_a}'`)).toBe(versionEvento);
    await sinViolacionesA11y(page);
  });

  test('un organizador no accede al tablero ni a la exportación', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    expect((await context.request.get(`/api/admin/temporadas/${ids.temporada}/exportar/historial`)).status()).toBe(403);
    await page.goto(`/es/admin/temporadas/${ids.temporada}`);
    await expect(page).not.toHaveURL(/\/admin\//);
  });
});
