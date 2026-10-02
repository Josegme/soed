import { createHmac } from 'node:crypto';

/**
 * Identificador seudónimo del origen de una solicitud pública para el límite
 * de frecuencia (TR-34). Se guarda un HMAC de la IP, nunca la IP (LGPD).
 * En Vercel, `x-forwarded-for` lo escribe la plataforma: su primer valor es el cliente.
 */
export function ipDeEncabezados(h: { get(nombre: string): string | null }): string {
  return (h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? 'desconocido').trim() || 'desconocido';
}

export function huellaOrigen(ip: string, secreto: string): string {
  return createHmac('sha256', secreto).update(ip).digest('base64url').slice(0, 22);
}

/** Secreto del HMAC: uno propio o, si falta, la clave de servidor (nunca un valor fijo, que permitiría revertir IPv4). */
export function secretoOrigen(): string {
  const secreto = process.env.ORIGEN_HMAC_SECRETO ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secreto) throw new Error('ORIGEN_HMAC_SECRETO no configurado');
  return secreto;
}
