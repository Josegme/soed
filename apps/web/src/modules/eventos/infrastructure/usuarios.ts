import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Busca la cuenta de un email para asignarla a un evento. Los perfiles ajenos
 * no son visibles por RLS (privacidad): solo se usa después de confirmar el
 * permiso `evento.miembros` y devuelve únicamente el id.
 */
export async function usuarioIdPorEmail(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from('perfil').select('id').ilike('email', email.trim()).limit(1).maybeSingle();
  return data?.id ?? null;
}
