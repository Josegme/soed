import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { PREFIJO_URL } from '@/lib/i18n/locales';
import { supabaseServidor } from '@/lib/supabase/server';

const TIPOS: readonly EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

/** Confirmación de email por token_hash (registro e invitaciones). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const tipo = searchParams.get('type') as EmailOtpType | null;
  const locale = searchParams.get('locale') === 'pt-BR' ? 'pt-BR' : 'es';
  if (tokenHash && tipo && TIPOS.includes(tipo)) {
    const supabase = await supabaseServidor();
    const { error } = (await supabase?.auth.verifyOtp({ type: tipo, token_hash: tokenHash })) ?? { error: true };
    if (!error) return NextResponse.redirect(`${origin}${PREFIJO_URL[locale]}/panel`);
  }
  return NextResponse.redirect(`${origin}${PREFIJO_URL[locale]}/ingresar?error=enlace`);
}
