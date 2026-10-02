import 'server-only';
import { esIdioma, type Idioma } from '@soed/domain';
import type { Json } from '@soed/shared-types/database';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { modoEmail } from '@/lib/entorno';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { Audiencia, Destinatario, PuertosComunicados } from '../application/comunicados';

/**
 * Comunicados: el registro se escribe con RLS (`comunicados.enviar`). Los
 * destinatarios se resuelven con la clave de servidor porque los perfiles de
 * academias no son visibles para el organizador (privacidad); solo se llega
 * aquí después de verificar el permiso en el caso de uso.
 */
export function puertosComunicadosSupabase(db: ClienteSupabase, sesion: Sesion): PuertosComunicados {
  return {
    puedeEnviar: (eventoId) => tienePermiso(sesion, eventoId, 'comunicados.enviar'),
    async idiomaDefecto(eventoId) {
      const { data } = await db.from('evento').select('idioma_defecto').eq('id', eventoId).single();
      return data && esIdioma(data.idioma_defecto) ? data.idioma_defecto : 'es';
    },
    async destinatarios(eventoId, audiencia) {
      const admin = supabaseAdmin();
      const usuarios = new Set<string>();
      if (audiencia.includes('ACADEMIAS')) {
        const { data } = await admin
          .from('inscripcion')
          .select('academia:academia_id (academia_miembro (usuario_id, activo))')
          .eq('evento_id', eventoId);
        for (const i of data ?? []) for (const m of i.academia?.academia_miembro ?? []) if (m.activo) usuarios.add(m.usuario_id);
      }
      if (audiencia.includes('JURADOS') || audiencia.includes('STAFF')) {
        const [{ data: miembros }, { data: jurados }] = await Promise.all([
          admin.from('evento_miembro').select('usuario_id, rol').eq('evento_id', eventoId).eq('activo', true),
          admin.from('rol_permiso').select('rol').eq('permiso', 'puntajes.cargar'),
        ]);
        const rolesJurado = new Set((jurados ?? []).map((r) => r.rol));
        for (const m of miembros ?? []) {
          const esJurado = rolesJurado.has(m.rol);
          if ((esJurado && audiencia.includes('JURADOS')) || (!esJurado && audiencia.includes('STAFF'))) usuarios.add(m.usuario_id);
        }
      }
      if (usuarios.size === 0) return [];
      const { data: perfiles } = await admin.from('perfil').select('id, email, idioma').in('id', [...usuarios]);
      return (perfiles ?? [])
        .filter((p) => p.email)
        .map((p): Destinatario => ({ usuarioId: p.id, email: p.email!, idioma: esIdioma(p.idioma) ? p.idioma : ('es' as Idioma) }));
    },
    async guardarComunicado(c) {
      const { data, error } = await db
        .from('comunicado')
        .insert({
          evento_id: c.eventoId,
          asunto: c.asunto as Json,
          cuerpo: c.cuerpo as Json,
          audiencia: c.audiencia satisfies Audiencia[],
          estado: 'ENVIADO',
          creado_por: sesion.usuarioId,
          enviado_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'COMUNICADO_NO_GUARDADO');
      return data.id;
    },
    async encolar(eventoId, comunicadoId, emails) {
      // ADR-0013: fuera de producción quedan SIMULADO (sink) y nunca salen a terceros.
      const estado = modoEmail() === 'resend' ? 'PENDIENTE' : 'SIMULADO';
      const { error } = await supabaseAdmin()
        .from('email_envio')
        .insert(
          emails.map((e) => ({
            evento_id: eventoId,
            usuario_id: e.usuarioId,
            destinatario: e.destinatario,
            plantilla: 'comunicado',
            idioma: e.idioma,
            estado,
            payload: { comunicadoId, asunto: e.asunto, cuerpo: e.cuerpo } as Json,
          })),
        );
      if (error) throw new Error(error.message);
    },
  };
}
