import 'server-only';
import { Resend } from 'resend';
import type { ProveedorEmail } from './enviar';

/** Proveedor Resend (ADR-0013). La API key vive solo en variables de entorno del servidor. */
export function proveedorResend(apiKey: string): ProveedorEmail {
  const resend = new Resend(apiKey);
  return {
    async enviar(m) {
      const { data, error } = await resend.emails.send(
        { from: m.de, to: m.para, subject: m.asunto, html: m.html, text: m.texto },
        { idempotencyKey: m.idempotencia },
      );
      if (error || !data) throw new Error(error?.message ?? 'RESEND_SIN_RESPUESTA');
      return { id: data.id };
    },
  };
}
