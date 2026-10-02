import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sql } from './utilidades';

test.describe('[PR-16] [OR-27] PDF de liquidación', () => {
  test('la academia descarga su liquidación en PDF en su idioma', async ({ context }) => {
    await ingresarComo(context, 'prof1');
    const r = await context.request.get(`/api/liquidaciones/${ids.liq1}/pdf?idioma=pt-BR`);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toBe('application/pdf');
    expect(r.headers()['content-disposition']).toContain('LIQ-SELA-0001-v1.pdf');
    expect((await r.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('otra academia no puede descargarla y sin sesión se rechaza', async ({ context, playwright }) => {
    await ingresarComo(context, 'prof2');
    expect((await context.request.get(`/api/liquidaciones/${ids.liq1}/pdf`)).status()).toBe(404);
    const anonimo = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
    expect((await anonimo.get(`/api/liquidaciones/${ids.liq1}/pdf`)).status()).toBe(401);
    await anonimo.dispose();
  });
});

test.describe('[OR-49] exportaciones CSV', () => {
  test('el organizador exporta fichas y queda constancia en la auditoría', async ({ context }) => {
    await ingresarComo(context, 'org_a');
    const r = await context.request.get(`/api/gestion/${ids.evento_a}/exportar/fichas?idioma=es`);
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type']).toContain('text/csv');
    const texto = (await r.body()).toString('utf8');
    expect(texto.startsWith('﻿Academia;Coreografía;Género')).toBe(true);
    expect(texto).toContain('Solo de Ana');
    expect(
      Number(sql(`select count(*) from public.auditoria where tabla = 'exportacion' and usuario_id = '${ids.org_a}'`)),
    ).toBeGreaterThan(0);
  });

  test('el staff de acreditación no exporta', async ({ context }) => {
    await ingresarComo(context, 'staff_a');
    expect((await context.request.get(`/api/gestion/${ids.evento_a}/exportar/cobros`)).status()).toBe(403);
  });
});
