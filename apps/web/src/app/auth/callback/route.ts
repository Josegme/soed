import { NextResponse, type NextRequest } from 'next/server';
import { PREFIJO_URL } from '@/lib/i18n/locales';
import { rutaInternaSegura } from '@/lib/rutas';
import { supabaseServidor } from '@/lib/supabase/server';

/** Intercambio PKCE del enlace mágico y OAuth (Google). Solo redirige dentro del sitio. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const codigo = searchParams.get('code');
  const locale = searchParams.get('locale') === 'pt-BR' ? 'pt-BR' : 'es';
  const destino = `${origin}${PREFIJO_URL[locale]}${rutaInternaSegura(searchParams.get('siguiente')) ?? '/panel'}`;
  if (codigo) {
    const supabase = await supabaseServidor();
    const { error } = (await supabase?.auth.exchangeCodeForSession(codigo)) ?? { error: true };
    if (!error) return NextResponse.redirect(destino);
  }
  return NextResponse.redirect(`${origin}${PREFIJO_URL[locale]}/ingresar?error=enlace`);
}
