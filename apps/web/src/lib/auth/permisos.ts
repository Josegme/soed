import { esIdioma, type Idioma } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

export interface AcademiaDeSesion {
  id: string;
  nombre: string;
  rol: 'TITULAR' | 'PROFESOR';
}

export interface Sesion {
  usuarioId: string;
  email: string;
  nombre: string;
  idioma: Idioma;
  esSuperAdmin: boolean;
  /** Permisos efectivos por evento (ADR-0007). Super Admin tiene todos en todos. */
  permisos: ReadonlyMap<string, ReadonlySet<string>>;
  roles: ReadonlyMap<string, readonly string[]>;
  academias: readonly AcademiaDeSesion[];
}

/**
 * Construye la sesión con roles y permisos leídos con RLS (cada usuario solo
 * ve sus propias membresías). Separada de las cookies para poder probarla.
 */
export async function construirSesion(db: ClienteSupabase, usuario: { id: string; email?: string | null }): Promise<Sesion> {
  const id = usuario.id;
  const [perfil, global, membresias, catalogo, academias] = await Promise.all([
    db.from('perfil').select('nombre, idioma, email').eq('id', id).maybeSingle(),
    db.from('rol_global').select('rol').eq('usuario_id', id),
    db.from('evento_miembro').select('evento_id, rol').eq('usuario_id', id).eq('activo', true),
    db.from('rol_permiso').select('rol, permiso'),
    db.from('academia_miembro').select('rol, academia:academia_id (id, nombre)').eq('usuario_id', id).eq('activo', true),
  ]);

  const permisosDeRol = new Map<string, string[]>();
  for (const rp of catalogo.data ?? []) permisosDeRol.set(rp.rol, [...(permisosDeRol.get(rp.rol) ?? []), rp.permiso]);

  const permisos = new Map<string, Set<string>>();
  const roles = new Map<string, string[]>();
  for (const m of membresias.data ?? []) {
    const set = permisos.get(m.evento_id) ?? new Set<string>();
    for (const p of permisosDeRol.get(m.rol) ?? []) set.add(p);
    permisos.set(m.evento_id, set);
    roles.set(m.evento_id, [...(roles.get(m.evento_id) ?? []), m.rol]);
  }

  const idioma = perfil.data?.idioma && esIdioma(perfil.data.idioma) ? perfil.data.idioma : 'es';
  return {
    usuarioId: id,
    email: usuario.email ?? perfil.data?.email ?? '',
    nombre: perfil.data?.nombre ?? '',
    idioma,
    esSuperAdmin: (global.data ?? []).some((g) => g.rol === 'SUPER_ADMIN'),
    permisos,
    roles,
    academias: (academias.data ?? [])
      .filter((a) => a.academia)
      .map((a) => ({ id: a.academia!.id, nombre: a.academia!.nombre, rol: a.rol as AcademiaDeSesion['rol'] })),
  };
}

export function tienePermiso(sesion: Sesion, eventoId: string, permiso: string): boolean {
  return sesion.esSuperAdmin || (sesion.permisos.get(eventoId)?.has(permiso) ?? false);
}

/** Eventos donde el usuario tiene un permiso (Super Admin: se resuelve consultando todos). */
export function eventosConPermiso(sesion: Sesion, permiso: string): string[] {
  return [...sesion.permisos].filter(([, p]) => p.has(permiso)).map(([id]) => id);
}
