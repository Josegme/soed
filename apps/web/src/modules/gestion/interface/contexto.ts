import 'server-only';
import type { Idioma } from '@soed/domain';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { eventoDeGestion } from '../infrastructure/consultas';

/** Secciones del panel de gestión y el permiso que habilita cada una (ADR-0007). */
export const SECCIONES_GESTION = [
  { clave: 'resumen', ruta: '', permisos: ['inscripciones.ver', 'evento.configurar', 'liquidaciones.ver'] },
  { clave: 'inscripciones', ruta: '/inscripciones', permisos: ['inscripciones.ver'] },
  { clave: 'cobros', ruta: '/cobros', permisos: ['liquidaciones.ver'] },
  { clave: 'orden', ruta: '/orden', permisos: ['orden.editar'] },
  { clave: 'puntajes', ruta: '/puntajes', permisos: ['puntajes.supervisar'] },
  { clave: 'premios', ruta: '/premios', permisos: ['premios.asignar', 'evento.configurar'] },
  { clave: 'pases', ruta: '/pases', permisos: ['pases.registrar'] },
  { clave: 'comunicados', ruta: '/comunicados', permisos: ['comunicados.enviar'] },
  { clave: 'equipo', ruta: '/equipo', permisos: ['evento.miembros'] },
  { clave: 'configuracion', ruta: '/configuracion', permisos: ['evento.configurar'] },
  { clave: 'auditoria', ruta: '/auditoria', permisos: ['auditoria.ver'] },
] as const;

export type SeccionGestion = (typeof SECCIONES_GESTION)[number]['clave'];

/** Sesión, evento y verificación de permiso de la sección; si no corresponde, vuelve al panel. */
export async function contextoGestion(eventoId: string, seccion: SeccionGestion) {
  const { sesion, db } = await requerirSesion();
  const definicion = SECCIONES_GESTION.find((s) => s.clave === seccion)!;
  if (!definicion.permisos.some((p) => tienePermiso(sesion, eventoId, p))) {
    redirect({ href: '/panel', locale: await getLocale() });
  }
  const evento = await eventoDeGestion(db, eventoId);
  if (!evento) notFound();
  const puede = (permiso: string) => tienePermiso(sesion, eventoId, permiso);
  return { sesion, db, evento, puede, defecto: evento.idioma_defecto as Idioma };
}
