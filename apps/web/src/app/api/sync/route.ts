import { NextResponse, type NextRequest } from 'next/server';
import { codigoDeError } from '@/lib/acciones';
import { obtenerSesion } from '@/lib/auth/sesion';
import { despachar, operacionSchema } from '@/modules/sincronizacion/interface/despachar';

/**
 * Reenvío de la cola offline (ADR-0010): jurado, acreditación y mesa de caja.
 * 200 = aplicada (o ya aplicada); 422 = rechazo definitivo con código;
 * 401 = sin sesión; 503 = reintentar.
 */
export async function POST(request: NextRequest) {
  // CSRF: solo JSON del mismo origen (las cookies de sesión son SameSite=Lax).
  const origen = request.headers.get('origin');
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (origen && new URL(origen).host !== request.headers.get('host'))) {
    return NextResponse.json({ ok: false, codigo: 'ORIGEN_INVALIDO' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.startsWith('application/json')) {
    return NextResponse.json({ ok: false, codigo: 'FORMATO_INVALIDO' }, { status: 415 });
  }
  const actual = await obtenerSesion();
  if (!actual) return NextResponse.json({ ok: false, codigo: 'SIN_SESION' }, { status: 401 });

  const op = operacionSchema.safeParse(await request.json().catch(() => null));
  if (!op.success) return NextResponse.json({ ok: false, codigo: 'DATOS_INVALIDOS' }, { status: 422 });
  try {
    const r = await despachar(op.data, actual.db, actual.sesion, new Date());
    return NextResponse.json(r, { status: r.ok ? 200 : 422 });
  } catch (e) {
    const codigo = codigoDeError(e);
    // Errores de reglas de la base (códigos en mayúsculas) son definitivos; el resto se reintenta.
    if (codigo !== 'INESPERADO') return NextResponse.json({ ok: false, codigo }, { status: 422 });
    console.error('[sync]', e);
    return NextResponse.json({ ok: false, codigo }, { status: 503 });
  }
}
