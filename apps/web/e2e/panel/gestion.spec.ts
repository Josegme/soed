import { expect, test } from '@playwright/test';
import { ids, ingresarComo, sinViolacionesA11y, sql } from './utilidades';

const SECCIONES = [
  '',
  '/inscripciones',
  '/cobros',
  '/orden',
  '/puntajes',
  '/premios',
  '/pases',
  '/comunicados',
  '/equipo',
  '/configuracion',
  '/auditoria',
];

test.describe('[OR-45] [ADR-0007] panel del organizador', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'org_a'));

  test('muestra el tablero del evento con las pestañas de sus permisos', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Selectivo A');
    const pestanas = page.getByRole('navigation', { name: 'Secciones del evento' });
    for (const nombre of [
      'Resumen',
      'Inscripciones',
      'Cobros',
      'Orden de salida',
      'Puntajes',
      'Pases',
      'Comunicados',
      'Equipo',
      'Configuración',
      'Auditoría',
    ]) {
      await expect(pestanas.getByRole('link', { name: nombre })).toBeVisible();
    }
    await expect(pestanas.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Academias inscriptas')).toBeVisible();
  });

  for (const seccion of SECCIONES) {
    test(`[PU-13] accesibilidad de gestión${seccion || '/resumen'}`, async ({ page }, info) => {
      await page.goto(`/es/gestion/${ids.evento_a}${seccion}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await sinViolacionesA11y(page);
      await page.screenshot({ path: info.outputPath(`gestion${seccion.replace('/', '-') || '-resumen'}.png`), fullPage: true });
    });
  }

  test('[OR-28] [OR-29] registra un cobro manual desde la tabla de liquidaciones', async ({ page }) => {
    const antes = Number(sql(`select count(*) from public.cobro where liquidacion_id = '${ids.liq1}'`));
    await page.goto(`/es/gestion/${ids.evento_a}/cobros`);
    const fila = page.getByRole('row', { name: /LIQ-SELA-0001/ });
    await fila.getByText('Registrar cobro').click();
    await fila.getByRole('textbox', { name: /Monto/ }).fill('25,50');
    await fila.getByRole('combobox', { name: 'Medio' }).selectOption('EFECTIVO');
    await fila.getByRole('button', { name: 'Confirmar cobro' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Cobro registrado.' })).toBeVisible();
    expect(Number(sql(`select count(*) from public.cobro where liquidacion_id = '${ids.liq1}'`))).toBe(antes + 1);
    expect(
      sql(`select monto_centavos || medio from public.cobro where liquidacion_id = '${ids.liq1}' order by registrado_at desc limit 1`),
    ).toBe('2550EFECTIVO');
  });

  test('[OR-25] [TR-18] un descuento con motivo emite una nueva versión de la liquidación', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/cobros`);
    const tarjeta = page
      .getByRole('listitem')
      .filter({ has: page.getByText('Academia Uno', { exact: true }) })
      .filter({ hasText: 'Agregar ajuste' });
    await tarjeta.getByText('Agregar ajuste').click();
    await tarjeta.getByRole('combobox', { name: 'Tipo' }).selectOption('DESCUENTO_MONTO');
    await tarjeta.getByRole('textbox', { name: /Monto o porcentaje/ }).fill('10');
    await tarjeta.getByRole('textbox', { name: /Motivo/ }).fill('Academia invitada');
    await tarjeta.getByRole('button', { name: 'Registrar ajuste' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Ajuste registrado: se emitió LIQ-SELA-0001 versión 2/ })).toBeVisible();
    expect(sql(`select count(*) from public.liquidacion_version where liquidacion_id = '${ids.liq1}'`)).toBe('2');
    expect(
      sql(`select detalle::text like '%AJUSTE%' from public.liquidacion_version where liquidacion_id = '${ids.liq1}' and version = 2`),
    ).toBe('t');
  });

  test('[OR-21] observa una ficha con comentario', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/inscripciones`);
    const ficha = page.getByRole('listitem').filter({ has: page.getByText('Solo de Carla', { exact: true }) });
    await ficha.getByText('Observar', { exact: true }).click();
    await ficha.getByRole('textbox', { name: /Qué debe corregir/ }).fill('Falta la autorización del menor.');
    await ficha.getByRole('button', { name: 'Enviar observación' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Observación enviada' })).toBeVisible();
    expect(sql(`select estado || '|' || observacion from public.ficha where id = '${ids.ficha2}'`)).toBe(
      'OBSERVADA|Falta la autorización del menor.',
    );
  });

  test('[OR-20] filtra fichas por estado sin perder el filtro en la URL', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/inscripciones`);
    await page.getByRole('combobox', { name: 'Estado' }).selectOption('ENVIADA');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page).toHaveURL(/estado=ENVIADA/);
    await expect(page.getByRole('status').first()).toContainText('ficha');
  });

  test('[OR-41] [OP-02] [OP-05] desvío entre jurados visible y cálculo del ranking', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/puntajes`);
    await expect(page.getByText(/1 ficha con desvío entre jurados/)).toBeVisible();
    await page.getByRole('button', { name: 'Calcular resultados' }).click();
    await expect(page.getByRole('status').filter({ hasText: /resultados/ })).toBeVisible();
    expect(Number(sql(`select count(*) from public.resultado where evento_id = '${ids.evento_a}'`))).toBeGreaterThan(0);
  });

  test('[OR-10] [OR-43] crea un premio por ranking y lo asigna tras el cálculo', async ({ page }) => {
    await page.goto(`/es/gestion/${ids.evento_a}/premios`);
    await page.getByRole('textbox', { name: 'Nombre (Español)' }).fill('Mejor solista');
    await page.getByRole('textbox', { name: /Monto/ }).fill('100');
    await page.getByRole('combobox', { name: 'Asignación' }).selectOption('RANKING');
    await page.getByRole('button', { name: 'Crear' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Premio creado.' })).toBeVisible();
    await page.getByRole('button', { name: 'Asignar según el ranking' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Premio asignado a \d+/ })).toBeVisible();
    expect(Number(sql(`select count(*) from public.premio_asignacion where evento_id = '${ids.evento_a}'`))).toBeGreaterThan(0);
  });

  test('[TR-20] [PU-13] el panel en portugués usa sus textos @movil', async ({ page }) => {
    await page.goto(`/pt/gestion/${ids.evento_a}`);
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('navigation', { name: 'Seções do evento' }).getByRole('link', { name: 'Recebimentos' })).toBeVisible();
    await sinViolacionesA11y(page);
  });
});

test.describe('[TR-16] [TR-36] permisos por rol en la interfaz', () => {
  test('el staff de acreditación solo ve resumen, inscripciones, cobros y reservas', async ({ page, context }) => {
    await ingresarComo(context, 'staff_a');
    await page.goto(`/es/gestion/${ids.evento_a}`);
    const pestanas = page.getByRole('navigation', { name: 'Secciones del evento' });
    await expect(pestanas.getByRole('link')).toHaveText(['Resumen', 'Inscripciones', 'Cobros', 'Clases y entradas']);
    await page.goto(`/es/gestion/${ids.evento_a}/configuracion`);
    await expect(page).not.toHaveURL(/configuracion/);
  });

  test('el organizador de otro evento no entra a la gestión de A', async ({ page, context }) => {
    await ingresarComo(context, 'org_b');
    await page.goto(`/es/gestion/${ids.evento_a}`);
    await expect(page).not.toHaveURL(new RegExp(`gestion/${ids.evento_a}`));
  });

  test('una academia no entra a la gestión', async ({ page, context }) => {
    await ingresarComo(context, 'prof1');
    await page.goto(`/es/gestion/${ids.evento_a}/cobros`);
    await expect(page).toHaveURL(/\/es\/academia/);
  });
});

test.describe('[SA-01] [SA-02] administración', () => {
  test.beforeEach(async ({ context }) => ingresarComo(context, 'sa'));

  test('lista temporadas y eventos, y es accesible', async ({ page }, info) => {
    await page.goto('/es/admin');
    await expect(page.getByRole('heading', { name: 'Temporada 2027' })).toBeVisible();
    await expect(page.getByRole('main').getByText('Selectivo A', { exact: true })).toBeVisible();
    await sinViolacionesA11y(page);
    await page.screenshot({ path: info.outputPath('admin.png'), fullPage: true });
  });

  test('[SA-03] crea un evento clonando otro y abre su configuración', async ({ page }) => {
    await page.goto('/es/admin/eventos/nuevo');
    await sinViolacionesA11y(page);
    await page.getByRole('textbox', { name: /Código/ }).fill('POA27');
    await page.getByRole('textbox', { name: /Nombre \(Español\)/ }).fill('Selectivo Porto Alegre');
    await page.getByLabel(/Fecha de inicio/).fill('2027-08-10');
    await page.getByLabel(/Fecha de fin/).fill('2027-08-11');
    await page.getByRole('combobox', { name: /Copiar configuración/ }).selectOption({ label: 'SELA · Selectivo A' });
    await page.getByRole('button', { name: 'Crear evento' }).click();
    await expect(page).toHaveURL(/\/gestion\/[0-9a-f-]+\/configuracion/);
    expect(sql(`select count(*) from public.criterio c join public.evento e on e.id = c.evento_id where e.slug = 'POA27'`)).toBe('2');
  });

  test('valida el formulario y conserva lo escrito', async ({ page }) => {
    await page.goto('/es/admin/eventos/nuevo');
    await page.getByRole('textbox', { name: /Código/ }).fill('x');
    await page.getByRole('button', { name: 'Crear evento' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/eventos\/nuevo/);
  });
});
