import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

test.describe.configure({ mode: 'serial' });

test.describe('[JU-02] [JU-03] [JU-06] [JU-08] planilla del jurado', () => {
  test('carga notas, ve el total ponderado y envía con confirmación', async ({ page, context }, info) => {
    await ingresarComo(context, 'jur1_a');
    await page.goto(`/es/jurado/${ids.evento_a}?ficha=${ids.ficha2}`);
    await expect(page.getByRole('heading', { name: 'Solo de Carla' })).toBeVisible();
    await sinViolacionesA11y(page);
    await page.getByRole('spinbutton', { name: /Técnica/ }).fill('8');
    await page.getByRole('spinbutton', { name: /Interpretación/ }).fill('7.5');
    await expect(page.locator('output')).toHaveText('7,83');
    await page.getByRole('button', { name: 'Enviar planilla' }).click();
    await page.getByRole('button', { name: 'Confirmar envío' }).click();
    await expect(page.getByText('Planilla enviada', { exact: false }).first()).toBeVisible();
    expect(sql(`select estado from public.planilla where ficha_id = '${ids.ficha2}' and jurado_id = '${ids.jur1_a}'`)).toBe('ENVIADA');
    await page.screenshot({ path: info.outputPath('jurado.png'), fullPage: true });
  });

  test('[JU-05] sin conexión guarda en el dispositivo y sincroniza al volver', async ({ page, context }) => {
    await ingresarComo(context, 'jur2_a');
    await page.goto(`/es/jurado/${ids.evento_a}?ficha=${ids.ficha2}`);
    await expect(page.getByRole('heading', { name: 'Solo de Carla' })).toBeVisible();
    await context.setOffline(true);
    await page.getByRole('spinbutton', { name: /Técnica/ }).fill('7');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await expect(page.getByText(/la planilla quedó en este dispositivo/)).toBeVisible();
    await expect(page.getByText('1 operación por enviar')).toBeVisible();
    expect(sql(`select count(*) from public.planilla where ficha_id = '${ids.ficha2}' and jurado_id = '${ids.jur2_a}'`)).toBe('0');
    await context.setOffline(false);
    await expect(page.getByText('1 operación por enviar')).toBeHidden({ timeout: 15_000 });
    expect(sql(`select estado from public.planilla where ficha_id = '${ids.ficha2}' and jurado_id = '${ids.jur2_a}'`)).toBe('BORRADOR');
  });
});

test.describe('[OP-17] [OP-18] [OP-25] [TR-12] acreditación y caja', () => {
  test('emite credenciales y acredita por código; el segundo escaneo informa la hora', async ({ page, context }, info) => {
    await ingresarComo(context, 'staff_a');
    await page.goto(`/es/acreditacion/${ids.evento_a}`);
    await page.getByRole('button', { name: 'Emitir credenciales faltantes' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Se emitieron \d+ credenciales/ })).toBeVisible();
    await sinViolacionesA11y(page);
    const token = sql(`select qr_token from public.credencial where evento_id = '${ids.evento_a}' and bailarin_id = '${ids.bailarin1}'`);
    const codigo = page.getByRole('textbox', { name: 'Código de la credencial' });
    await codigo.fill(token);
    await page.getByRole('button', { name: 'Acreditar', exact: true }).click();
    await expect(page.getByText('Ana Uno: acreditado')).toBeVisible();
    await page.waitForTimeout(4_100);
    await codigo.fill(token);
    await page.getByRole('button', { name: 'Acreditar', exact: true }).click();
    await expect(page.getByText(/Ana Uno ya estaba acreditado/)).toBeVisible();
    await page.screenshot({ path: info.outputPath('acreditacion.png'), fullPage: true });
  });

  test('[OP-23] [PU-13] las credenciales imprimibles llevan QR y son accesibles', async ({ page, context }) => {
    await ingresarComo(context, 'staff_a');
    await page.goto(`/es/acreditacion/${ids.evento_a}/credenciales`);
    await expect(page.getByRole('img', { name: 'Código QR de Ana Uno' })).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('[OP-20] [OP-21] la mesa de caja registra un cobro sin conexión y lo envía al volver', async ({ page, context }) => {
    await ingresarComo(context, 'staff_a');
    const antes = Number(sql(`select count(*) from public.cobro where liquidacion_id = '${ids.liq1}'`));
    await page.goto(`/es/acreditacion/${ids.evento_a}/caja`);
    await sinViolacionesA11y(page);
    const fila = page.getByRole('row', { name: /LIQ-SELA-0001/ });
    await fila.getByText('Registrar cobro').click();
    await context.setOffline(true);
    await fila.getByRole('textbox', { name: /Monto/ }).fill('10');
    await fila.getByRole('button', { name: 'Confirmar cobro' }).click();
    await expect(page.getByText(/Guardado en el dispositivo/)).toBeVisible();
    await context.setOffline(false);
    await expect
      .poll(() => Number(sql(`select count(*) from public.cobro where liquidacion_id = '${ids.liq1}'`)), { timeout: 20_000 })
      .toBe(antes + 1);
  });
});

test.describe('[PU-13] vistas en vivo', () => {
  test('[OP-06] [OP-07] el coordinador avanza la pista con "Siguiente"', async ({ page, context }, info) => {
    sql(`update public.orden_item set estado = 'PROGRAMADA' where bloque_id = '${ids.bloque1}'`);
    await ingresarComo(context, 'coord_a');
    await page.goto(`/es/vivo/${ids.evento_a}/coordinador`);
    await sinViolacionesA11y(page);
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await expect
      .poll(() => sql(`select string_agg(estado, ',' order by posicion) from public.orden_item where bloque_id = '${ids.bloque1}'`))
      .toBe('EN_ESCENA,LLAMADA');
    await page.reload();
    await expect(page.getByText('Solo de Ana').first()).toBeVisible();
    await page.screenshot({ path: info.outputPath('coordinador.png'), fullPage: true });
  });

  test('[OP-11] [OP-12] el locutor ve en escena y llamada con buen contraste', async ({ page, context }, info) => {
    await ingresarComo(context, 'loc_a');
    await page.goto(`/es/vivo/${ids.evento_a}/locutor`);
    await expect(page.getByRole('region', { name: 'En escena' }).getByText('Solo de Ana')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Llamada' }).getByText('Solo de Carla')).toBeVisible();
    await sinViolacionesA11y(page);
    await page.screenshot({ path: info.outputPath('locutor.png'), fullPage: true });
  });

  test('[OP-13] [OP-15] el DJ ve la secuencia y el estado de cada música', async ({ page, context }) => {
    await ingresarComo(context, 'dj_a');
    await page.goto(`/es/vivo/${ids.evento_a}/dj`);
    await expect(page.getByText('Solo de Ana')).toBeVisible();
    await sinViolacionesA11y(page);
  });

  test('[OP-01] [OP-02] el director técnico ve planillas por jurado y el desvío', async ({ page, context }, info) => {
    sql(`update public.orden_item set estado = 'PRESENTADA' where id = '${ids.item1}'`);
    await ingresarComo(context, 'dt_a');
    await page.goto(`/es/vivo/${ids.evento_a}/director-tecnico`);
    await expect(page.getByRole('columnheader', { name: 'Jurado 1' })).toBeVisible();
    await expect(page.getByText('Desvío').first()).toBeVisible();
    await sinViolacionesA11y(page);
    await page.screenshot({ path: info.outputPath('director-tecnico.png'), fullPage: true });
  });

  test('[TR-36] un jurado no entra a la coordinación', async ({ page, context }) => {
    await ingresarComo(context, 'jur1_a');
    await page.goto(`/es/vivo/${ids.evento_a}/coordinador`);
    await expect(page).not.toHaveURL(/coordinador/);
  });
});
