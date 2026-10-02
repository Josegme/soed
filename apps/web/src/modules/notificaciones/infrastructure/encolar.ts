import 'server-only';
import { esIdioma, type Idioma, type Traducible } from '@soed/domain';
import type { Json } from '@soed/shared-types/database';
import { cliente } from '@/cliente';
import { modoEmail, urlSitio } from '@/lib/entorno';
import { PREFIJO_URL } from '@/lib/i18n/locales';
import { traductorServidor } from '@/lib/i18n/traductor-servidor';
import { texto } from '@/lib/i18n/traducible';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { contenidoEmail, type TipoNotificacion } from '../application/contenido';

/** Valor de un dato del email: texto fijo, traducible del organizador o función del idioma (montos, fechas). */
export type DatoEmail = string | Traducible | ((idioma: Idioma) => string);
export type DatosEmail = Record<string, DatoEmail>;

function resolver(datos: DatosEmail, idioma: Idioma): Record<string, string> {
  return Object.fromEntries(
    Object.entries(datos).map(([k, v]) => [k, typeof v === 'function' ? v(idioma) : typeof v === 'string' ? v : texto(v, idioma)]),
  );
}

interface Destinatario {
  usuarioId: string | null;
  email: string;
  idioma: Idioma;
}

/**
 * Encola emails en `email_envio` (ADR-0013), uno por destinatario y en su
 * idioma. Fuera de producción quedan SIMULADO y nunca salen. Se llama siempre
 * después de que la operación principal tuvo éxito y nunca la hace fallar.
 */
async function encolar(tipo: TipoNotificacion, eventoId: string | null, destinatarios: Destinatario[], datos: DatosEmail, ruta: string) {
  const unicos = [...new Map(destinatarios.filter((d) => d.email).map((d) => [d.email.toLowerCase(), d])).values()];
  if (unicos.length === 0) return 0;
  const estado = modoEmail() === 'resend' ? 'PENDIENTE' : 'SIMULADO';
  const filas = await Promise.all(
    unicos.map(async (d) => {
      const t = await traductorServidor(d.idioma, 'emails');
      const url = `${urlSitio()}${PREFIJO_URL[d.idioma]}${ruta}`;
      const valores = resolver(datos, d.idioma);
      const contenido = contenidoEmail(tipo, { marca: cliente.nombre, razonSocial: cliente.legal.razonSocial, ...valores }, t, url);
      return {
        evento_id: eventoId,
        usuario_id: d.usuarioId,
        destinatario: d.email,
        plantilla: tipo,
        idioma: d.idioma,
        estado,
        // `clave` permite deduplicar envíos programados (recordatorios).
        payload: { ...contenido, ...(valores.clave ? { clave: valores.clave } : {}) } as unknown as Json,
      };
    }),
  );
  const { error } = await supabaseAdmin().from('email_envio').insert(filas);
  if (error) throw new Error(error.message);
  return filas.length;
}

async function miembrosDeAcademias(academias: readonly string[]): Promise<Destinatario[]> {
  if (academias.length === 0) return [];
  const admin = supabaseAdmin();
  const { data: miembros } = await admin
    .from('academia_miembro')
    .select('usuario_id')
    .in('academia_id', [...academias])
    .eq('activo', true);
  const ids = [...new Set((miembros ?? []).map((m) => m.usuario_id))];
  if (ids.length === 0) return [];
  const { data: perfiles } = await admin.from('perfil').select('id, email, idioma').in('id', ids);
  return (perfiles ?? [])
    .filter((p) => p.email)
    .map((p) => ({ usuarioId: p.id, email: p.email!, idioma: esIdioma(p.idioma) ? p.idioma : 'es' }));
}

/** Notifica a los profesores de una academia (inscripción, liquidación, cobro, ficha observada). */
export async function notificarAcademia(p: {
  eventoId: string;
  academiaId: string;
  tipo: TipoNotificacion;
  datos: DatosEmail;
  ruta: string;
}) {
  return encolar(p.tipo, p.eventoId, await miembrosDeAcademias([p.academiaId]), p.datos, p.ruta);
}

/** Notifica a todas las academias inscriptas en el evento (orden y resultados publicados). */
export async function notificarAcademiasDelEvento(p: { eventoId: string; tipo: TipoNotificacion; datos: DatosEmail; ruta: string }) {
  const { data } = await supabaseAdmin().from('inscripcion').select('academia_id').eq('evento_id', p.eventoId);
  return encolar(p.tipo, p.eventoId, await miembrosDeAcademias([...new Set((data ?? []).map((i) => i.academia_id))]), p.datos, p.ruta);
}

/** Email a una dirección sin cuenta todavía (invitaciones). */
export async function notificarEmail(p: { email: string; idioma: Idioma; tipo: TipoNotificacion; datos: DatosEmail; ruta: string }) {
  return encolar(p.tipo, null, [{ usuarioId: null, email: p.email, idioma: p.idioma }], p.datos, p.ruta);
}

/** Ejecuta una notificación sin que su falla afecte a la operación que la originó. */
export async function sinFallar(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error('[notificacion]', e instanceof Error ? e.message : e);
  }
}
