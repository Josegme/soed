import { z } from 'zod';

/**
 * Variables de entorno (ver .env.example). Se leen de forma perezosa para que
 * el sitio público funcione aunque Supabase todavía no esté configurado
 * (pendiente de credenciales): las pantallas que lo necesitan lo informan.
 */
const publicoSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
});

export interface EntornoPublico {
  supabaseUrl: string;
  supabaseClave: string;
}

export function entornoPublico(): EntornoPublico | null {
  const r = publicoSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  return r.success ? { supabaseUrl: r.data.NEXT_PUBLIC_SUPABASE_URL, supabaseClave: r.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } : null;
}

export const supabaseConfigurado = (): boolean => entornoPublico() !== null;

export function urlSitio(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export type ModoEmail = 'sink' | 'resend';

/** En desarrollo y preview nunca se envían emails reales a terceros (ADR-0013). */
export function modoEmail(): ModoEmail {
  return process.env.EMAIL_MODO === 'resend' && process.env.VERCEL_ENV === 'production' ? 'resend' : 'sink';
}
