import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Reservas públicas (PU-09, PU-10): única vía de alta para visitantes sin
 * cuenta. La función de base aplica publicación, cupo y límite de frecuencia
 * por origen y por email; aquí solo se invoca con service role.
 */
export async function reservarEntradaPublica(p: {
  entradaTipoId: string;
  nombre: string;
  email: string;
  cantidad: number;
  origen: string;
}) {
  const { data, error } = await supabaseAdmin().rpc('reservar_entrada', {
    p_entrada_tipo_id: p.entradaTipoId,
    p_nombre: p.nombre,
    p_email: p.email,
    p_cantidad: p.cantidad,
    p_origen: p.origen,
  });
  if (error) throw error;
  const fila = data?.[0];
  if (!fila) throw new Error('INESPERADO');
  return { id: fila.id, codigo: fila.codigo };
}

export async function reservarClasePublica(p: { claseId: string; nombre: string; email: string; origen: string }) {
  const { data, error } = await supabaseAdmin().rpc('reservar_clase', {
    p_clase_id: p.claseId,
    p_nombre: p.nombre,
    p_email: p.email,
    p_origen: p.origen,
  });
  if (error) throw error;
  return { id: data as string };
}

/** Datos para el email de confirmación: evento y nombre de lo reservado. */
export async function datosReserva(tipo: 'clase' | 'entrada', id: string) {
  const admin = supabaseAdmin();
  const tabla = tipo === 'clase' ? 'clase' : 'entrada_tipo';
  const { data } = await admin
    .from(tabla)
    .select('nombre, precio_centavos, evento:evento_id (slug, nombre, moneda, idioma_defecto)')
    .eq('id', id)
    .single();
  return data;
}
