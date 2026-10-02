import { createHmac } from 'node:crypto';

const b64 = (valor: string | Buffer) => Buffer.from(valor).toString('base64url');

/** JWT HS256 como los que emite Supabase Auth (solo para pruebas de integración). */
export function firmarJwt(claims: Record<string, unknown>, secreto: string): string {
  const cabecera = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const cuerpo = b64(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000), ...claims }));
  const firma = createHmac('sha256', secreto).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return `${cabecera}.${cuerpo}.${firma}`;
}

export function verificarJwt(token: string, secreto: string): Record<string, unknown> | null {
  const [cabecera, cuerpo, firma] = token.split('.');
  if (!cabecera || !cuerpo || !firma) return null;
  const esperada = createHmac('sha256', secreto).update(`${cabecera}.${cuerpo}`).digest('base64url');
  return esperada === firma ? JSON.parse(Buffer.from(cuerpo, 'base64url').toString()) : null;
}
