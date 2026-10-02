import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Autoriza una invocación de Vercel Cron (header Authorization: Bearer
 * CRON_SECRET). Sin secreto configurado, los crons quedan deshabilitados.
 */
export function cronAutorizado(request: NextRequest): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) return false;
  const recibido = Buffer.from(request.headers.get('authorization') ?? '');
  const esperado = Buffer.from(`Bearer ${secreto}`);
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}
