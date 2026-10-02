'use server';

import { ingresoSchema, magicLinkSchema, registroSchema } from '@soed/shared-types';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { urlSitio } from '@/lib/entorno';
import { erroresDe, valoresDe, type EstadoFormulario } from '@/lib/formularios';
import { supabaseServidor } from '@/lib/supabase/server';

export async function ingresar(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = ingresoSchema.safeParse({ email: datos.get('email'), password: datos.get('password') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const supabase = await supabaseServidor();
  if (!supabase) return { ok: false, mensaje: 'CONFIG_PENDIENTE', valores };
  const { error } = await supabase.auth.signInWithPassword(entrada.data);
  if (error) return { ok: false, mensaje: 'credencialesInvalidas', valores };
  const locale = await getLocale();
  redirect({ href: '/panel', locale });
  return { ok: true };
}

export async function enviarEnlace(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = magicLinkSchema.safeParse({ email: datos.get('email') });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const supabase = await supabaseServidor();
  if (!supabase) return { ok: false, mensaje: 'CONFIG_PENDIENTE', valores };
  const locale = await getLocale();
  // No revela si el email existe: siempre responde lo mismo (JU-01).
  await supabase.auth.signInWithOtp({
    email: entrada.data.email,
    options: { shouldCreateUser: false, emailRedirectTo: `${urlSitio()}/auth/callback?locale=${locale}` },
  });
  return { ok: true, mensaje: 'enlaceEnviado' };
}

export async function registrarse(_previo: EstadoFormulario, datos: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(datos);
  const entrada = registroSchema.safeParse({
    nombre: datos.get('nombre'),
    email: datos.get('email'),
    password: datos.get('password'),
    idioma: datos.get('idioma'),
  });
  if (!entrada.success) return { ok: false, errores: erroresDe(entrada.error), valores };
  const supabase = await supabaseServidor();
  if (!supabase) return { ok: false, mensaje: 'CONFIG_PENDIENTE', valores };
  const { nombre, email, password, idioma } = entrada.data;
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, idioma }, emailRedirectTo: `${urlSitio()}/auth/confirmar?locale=${idioma}` },
  });
  // Mensaje neutro también si el email ya existe (evita enumeración de cuentas).
  if (error && error.status !== 400 && error.status !== 422) return { ok: false, mensaje: 'INESPERADO', valores };
  return { ok: true, mensaje: 'registroOk' };
}

export async function cerrarSesion(): Promise<void> {
  const supabase = await supabaseServidor();
  await supabase?.auth.signOut();
  const locale = await getLocale();
  redirect({ href: '/', locale });
}
