import 'server-only';
import { renderizarComunicado, renderizarTransaccional, type EmailAccion, type MarcaEmail } from '@soed/email-templates';
import type { createClient } from '@supabase/supabase-js';
import type { Database } from '@soed/shared-types/database';

type Admin = ReturnType<typeof createClient<Database>>;

export interface MensajeSaliente {
  idempotencia: string;
  de: string;
  para: string;
  asunto: string;
  html: string;
  texto: string;
}

export interface ProveedorEmail {
  enviar(m: MensajeSaliente): Promise<{ id: string }>;
}

const MAX_INTENTOS = 5;
const sinPii = (texto: string) => texto.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').slice(0, 500);

/**
 * Envía la cola de emails (ADR-0013). En modo sink no llama al proveedor: marca
 * lo pendiente como SIMULADO. Cada envío usa el id de la fila como clave de
 * idempotencia, así dos ejecuciones superpuestas no duplican.
 */
export async function enviarPendientes(
  admin: Admin,
  proveedor: ProveedorEmail | null,
  opciones: { modo: 'sink' | 'resend'; marca: MarcaEmail; remitente: string; limite?: number },
): Promise<{ enviados: number; fallidos: number; simulados: number }> {
  if (opciones.modo === 'sink' || !proveedor) {
    const { data } = await admin.from('email_envio').update({ estado: 'SIMULADO' }).eq('estado', 'PENDIENTE').select('id');
    return { enviados: 0, fallidos: 0, simulados: data?.length ?? 0 };
  }
  const { data: pendientes } = await admin
    .from('email_envio')
    .select('id, destinatario, plantilla, idioma, payload, intentos')
    .eq('estado', 'PENDIENTE')
    .lt('intentos', MAX_INTENTOS)
    .order('creado_at')
    .limit(opciones.limite ?? 50);
  let enviados = 0;
  let fallidos = 0;
  for (const e of pendientes ?? []) {
    const payload = (e.payload ?? {}) as Record<string, unknown>;
    const marca = { ...opciones.marca, pie: typeof payload.pie === 'string' ? payload.pie : opciones.marca.pie };
    try {
      const asunto = String(payload.asunto ?? '');
      const render =
        e.plantilla === 'comunicado'
          ? await renderizarComunicado({ idioma: e.idioma, marca, vistaPrevia: asunto, asunto, cuerpo: String(payload.cuerpo ?? '') })
          : await renderizarTransaccional({ ...(payload as unknown as EmailAccion), idioma: e.idioma, marca, vistaPrevia: asunto });
      const { id } = await proveedor.enviar({
        idempotencia: e.id,
        de: opciones.remitente,
        para: e.destinatario,
        asunto,
        html: render.html,
        texto: render.texto,
      });
      await admin
        .from('email_envio')
        .update({ estado: 'ENVIADO', proveedor_id: id, enviado_at: new Date().toISOString(), intentos: e.intentos + 1, error: null })
        .eq('id', e.id);
      enviados += 1;
    } catch (error) {
      const intentos = e.intentos + 1;
      await admin
        .from('email_envio')
        .update({
          estado: intentos >= MAX_INTENTOS ? 'FALLIDO' : 'PENDIENTE',
          intentos,
          error: sinPii(error instanceof Error ? error.message : String(error)),
        })
        .eq('id', e.id);
      fallidos += 1;
    }
  }
  return { enviados, fallidos, simulados: 0 };
}
