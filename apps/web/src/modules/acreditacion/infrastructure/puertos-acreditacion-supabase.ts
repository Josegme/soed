import 'server-only';
import type { CandidatoCredencial, ConfigAcreditacion, TipoCredencial } from '@soed/domain';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosAcreditacion } from '../application/acreditacion';

/**
 * Acreditación con el cliente del staff (RLS: `acreditacion.operar`). Los
 * candidatos a credencial (profesores y equipo) se leen con la clave de
 * servidor porque sus perfiles no son visibles para el staff; el caso de uso
 * verifica el permiso antes.
 */
export function puertosAcreditacionSupabase(db: ClienteSupabase, sesion: Sesion): PuertosAcreditacion {
  return {
    puede: (eventoId) => tienePermiso(sesion, eventoId, 'acreditacion.operar'),
    async credencialPorToken(token) {
      const { data } = await db
        .from('credencial')
        .select('id, evento_id, tipo, nombre_mostrado, zonas, acreditado_at, anulada, academia:academia_id (nombre)')
        .eq('qr_token', token)
        .maybeSingle();
      return data
        ? {
            id: data.id,
            eventoId: data.evento_id,
            tipo: data.tipo as TipoCredencial,
            nombre: data.nombre_mostrado,
            academia: data.academia?.nombre ?? null,
            zonas: data.zonas,
            acreditadoAt: data.acreditado_at,
            anulada: data.anulada,
          }
        : null;
    },
    async registroPorClientUuid(clientUuid) {
      const { data } = await db.from('acreditacion_registro').select('credencial_id').eq('client_uuid', clientUuid).maybeSingle();
      return data ? { credencialId: data.credencial_id } : null;
    },
    async registrar(d) {
      const { error } = await db.from('acreditacion_registro').insert({
        evento_id: d.eventoId,
        credencial_id: d.credencialId,
        accion: 'ACREDITAR',
        client_uuid: d.clientUuid,
        dispositivo_at: d.dispositivoAt,
        registrado_por: sesion.usuarioId,
      });
      if (error && error.code !== '23505') throw new Error(error.message);
    },
    async configuracion(eventoId) {
      const { data } = await db.from('evento').select('acreditacion').eq('id', eventoId).maybeSingle();
      return (data?.acreditacion ?? {}) as ConfigAcreditacion;
    },
    async candidatos(eventoId) {
      const admin = supabaseAdmin();
      const [{ data: bailarines }, { data: inscripciones }, { data: equipo }, { data: jurados }] = await Promise.all([
        admin
          .from('ficha_bailarin')
          .select('bailarin_id, academia_id, nombre_mostrado, ficha!inner (estado)')
          .eq('evento_id', eventoId)
          .in('ficha.estado', ['ENVIADA', 'APROBADA']),
        admin.from('inscripcion').select('academia_id').eq('evento_id', eventoId),
        admin.from('evento_miembro').select('usuario_id, rol').eq('evento_id', eventoId).eq('activo', true),
        admin.from('rol_permiso').select('rol').eq('permiso', 'puntajes.cargar'),
      ]);
      const academias = [...new Set((inscripciones ?? []).map((i) => i.academia_id))];
      const { data: profesores } = academias.length
        ? await admin.from('academia_miembro').select('usuario_id, academia_id').in('academia_id', academias).eq('activo', true)
        : { data: [] };
      const usuarios = [...new Set([...(profesores ?? []).map((p) => p.usuario_id), ...(equipo ?? []).map((m) => m.usuario_id)])];
      const { data: perfiles } = usuarios.length ? await admin.from('perfil').select('id, nombre, email').in('id', usuarios) : { data: [] };
      const nombre = new Map((perfiles ?? []).map((p) => [p.id, p.nombre || p.email || '']));
      const rolesJurado = new Set((jurados ?? []).map((r) => r.rol));
      const candidatos: CandidatoCredencial[] = [
        ...(bailarines ?? []).map((b) => ({
          tipo: 'BAILARIN' as const,
          nombre: b.nombre_mostrado,
          academiaId: b.academia_id,
          bailarinId: b.bailarin_id,
        })),
        ...(profesores ?? []).map((p) => ({
          tipo: 'PROFESOR' as const,
          nombre: nombre.get(p.usuario_id) ?? '',
          academiaId: p.academia_id,
          usuarioId: p.usuario_id,
        })),
        ...(equipo ?? []).map((m) => ({
          tipo: (rolesJurado.has(m.rol) ? 'JURADO' : 'STAFF') as TipoCredencial,
          nombre: nombre.get(m.usuario_id) ?? '',
          usuarioId: m.usuario_id,
        })),
      ];
      return candidatos;
    },
    async existentes(eventoId) {
      const { data } = await db.from('credencial').select('tipo, bailarin_id, usuario_id').eq('evento_id', eventoId);
      return (data ?? []).map((c) => ({ tipo: c.tipo as TipoCredencial, bailarinId: c.bailarin_id, usuarioId: c.usuario_id }));
    },
    async emitir(eventoId, nuevas) {
      const { error } = await db.from('credencial').insert(
        nuevas.map((n) => ({
          evento_id: eventoId,
          tipo: n.tipo,
          nombre_mostrado: n.nombre.slice(0, 250) || n.tipo,
          academia_id: n.academiaId ?? null,
          bailarin_id: n.bailarinId ?? null,
          usuario_id: n.usuarioId ?? null,
          zonas: [...n.zonas],
        })),
      );
      if (error) throw new Error(error.message);
    },
  };
}
