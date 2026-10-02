import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

test.describe.configure({ mode: 'serial' });

test.describe('[OR-47] [PR-33] comunicados del evento', () => {
  test('el organizador envía un comunicado bilingüe y la academia lo ve en su panel', async ({ page, context }) => {
    await ingresarComo(context, 'org_a');
    await page.goto(`/es/gestion/${ids.evento_a}/comunicados`);
    await page.getByRole('textbox', { name: 'Asunto (Español)' }).fill('Cambio de horario');
    await page.getByRole('textbox', { name: 'Asunto (Português)' }).fill('Mudança de horário');
    await page.getByRole('textbox', { name: 'Mensaje (Español)' }).fill('La acreditación abre a las 8.');
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Comunicado enviado/ })).toBeVisible();
    // Fuera de producción los emails quedan simulados: nunca salen a terceros.
    expect(Number(sql(`select count(*) from public.email_envio where evento_id = '${ids.evento_a}' and estado <> 'SIMULADO'`))).toBe(0);

    await ingresarComo(context, 'prof1');
    await page.goto('/pt/academia');
    const comunicados = page.getByRole('region', { name: 'Comunicados' });
    await expect(comunicados.getByText('Mudança de horário')).toBeVisible();
    // Sin traducción al portugués, el cuerpo cae al idioma del evento.
    await expect(comunicados.getByText('La acreditación abre a las 8.')).toBeVisible();
    await sinViolacionesA11y(page);
  });
});

test.describe('[OR-50] recordatorios automáticos', () => {
  test('el cron avisa una vez por día a las academias con fichas pendientes antes del cierre', async ({ request }) => {
    sql(`update public.evento set inscripcion_cierre = now() + interval '24 hours' where id = '${ids.evento_b}'`);
    const autorizacion = { authorization: `Bearer ${process.env.CRON_SECRET}` };
    expect((await request.get('/api/cron/recordatorios')).status()).toBe(401);
    const primera = await (await request.get('/api/cron/recordatorios', { headers: autorizacion })).json();
    expect(primera.enviados).toBeGreaterThan(0);
    const segunda = await (await request.get('/api/cron/recordatorios', { headers: autorizacion })).json();
    expect(segunda.enviados).toBe(0);
    expect(
      Number(sql(`select count(*) from public.email_envio where plantilla = 'recordatorio_cierre' and evento_id = '${ids.evento_b}'`)),
    ).toBe(primera.enviados);
  });
});
