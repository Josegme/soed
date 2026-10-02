import { NextResponse, type NextRequest } from 'next/server';
import { cliente } from '@/cliente';
import { cronAutorizado } from '@/lib/cron';
import { modoEmail, urlSitio } from '@/lib/entorno';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { enviarPendientes } from '@/modules/notificaciones/infrastructure/enviar';
import { proveedorResend } from '@/modules/notificaciones/infrastructure/resend';

export const runtime = 'nodejs';

/** Envío de la cola de emails (Vercel Cron, cada 5 minutos en planes que lo permiten). */
export async function GET(request: NextRequest) {
  if (!cronAutorizado(request)) return NextResponse.json({ codigo: 'NO_AUTORIZADO' }, { status: 401 });
  const modo = modoEmail();
  const clave = process.env.RESEND_API_KEY;
  const resultado = await enviarPendientes(supabaseAdmin(), modo === 'resend' && clave ? proveedorResend(clave) : null, {
    modo,
    remitente: `${cliente.email.nombreRemitente} <${cliente.email.remitente}>`,
    marca: {
      nombre: cliente.nombre,
      colorMarca: cliente.marca.colorTema,
      colorAcento: cliente.marca.colorTema,
      urlSitio: urlSitio(),
      pie: cliente.nombre,
    },
  });
  return NextResponse.json({ modo, ...resultado });
}
