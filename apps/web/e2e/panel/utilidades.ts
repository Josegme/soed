import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import AxeBuilder from '@axe-core/playwright';
import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Ids del fixture (tests.ids) leídos con psql del PostgreSQL efímero del script. */
export const ids: Record<string, string> = JSON.parse(
  execFileSync('psql', ['-X', '-A', '-t', '-c', 'select json_object_agg(clave, id) from tests.ids'], { encoding: 'utf8' }).trim(),
);

export function sql(consulta: string): string {
  return execFileSync('psql', ['-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', consulta], { encoding: 'utf8' }).trim();
}

const b64 = (v: string) => Buffer.from(v).toString('base64url');

function jwt(claims: Record<string, unknown>): string {
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify(claims));
  return `${h}.${p}.${createHmac('sha256', process.env.JWT_SECRET ?? '')
    .update(`${h}.${p}`)
    .digest('base64url')}`;
}

/**
 * Inyecta la sesión de un usuario del fixture como la cookie que escribe
 * @supabase/ssr (`sb-<ref>-auth-token`, codificación base64url). La API
 * (doble de Supabase) valida el JWT con el mismo secreto que PostgREST.
 */
export async function ingresarComo(context: BrowserContext, clave: string): Promise<void> {
  const id = ids[clave];
  if (!id) throw new Error(`usuario ${clave} inexistente en el fixture`);
  const ahora = Math.floor(Date.now() / 1000);
  const email = `${clave}@test.soed`;
  const accessToken = jwt({ sub: id, role: 'authenticated', aud: 'authenticated', email, iat: ahora, exp: ahora + 3600 });
  const sesion = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: ahora + 3600,
    refresh_token: 'e2e',
    user: {
      id,
      email,
      aud: 'authenticated',
      role: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date().toISOString(),
    },
  };
  await context.clearCookies();
  await context.addCookies([
    {
      name: 'sb-127-auth-token',
      value: `base64-${b64(JSON.stringify(sesion))}`,
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);
}

/** WCAG 2.2 AA: sin violaciones serias ni críticas. */
export async function sinViolacionesA11y(page: Page): Promise<void> {
  // Una página de error también es accesible: nunca debe contar como pantalla válida.
  await expect(page.getByRole('heading', { name: /No pudimos cargar esta página|Não conseguimos carregar esta página/ })).toHaveCount(0);
  // Desde el inicio: con scroll, el encabezado fijo tapa campos y axe lo reporta como target-size.
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const graves = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}
