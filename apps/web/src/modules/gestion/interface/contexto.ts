import 'server-only';
import type { Idioma } from '@soed/domain';
import type { Modulo } from '@soed/shared-types';
import { notFound } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { requerirSesion, tienePermiso } from '@/lib/auth/sesion';
import { habilitado } from '@/lib/modulos';
import { eventoDeGestion } from '../infrastructure/consultas';

/** Secciones del panel de gestión y el permiso que habilita cada una (ADR-0007). */
export const SECCIONES_GESTION = [
  { clave: 'resumen', ruta: '', permisos: ['inscripciones.ver', 'evento.configurar', 'liquidaciones.ver'], modulos: [] },
  { clave: 'inscripciones', ruta: '/inscripciones', permisos: ['inscripciones.ver'], modulos: ['inscripciones'] },
  { clave: 'cobros', ruta: '/cobros', permisos: ['liquidaciones.ver'], modulos: ['liquidaciones'] },
  { clave: 'orden', ruta: '/orden', permisos: ['orden.editar'], modulos: ['ordenEnVivo'] },
  { clave: 'puntajes', ruta: '/puntajes', permisos: ['puntajes.supervisar'], modulos: ['puntajes'] },
  { clave: 'premios', ruta: '/premios', permisos: ['premios.asignar', 'evento.configurar'], modulos: ['puntajes'] },
  { clave: 'hoteles', ruta: '/hoteles', permisos: ['evento.configurar', 'inscripciones.gestionar'], modulos: ['hoteles'] },
  { clave: 'actividades', ruta: '/actividades', permisos: ['evento.configurar', 'cobros.registrar'], modulos: ['clases', 'entradas'] },
  { clave: 'pases', ruta: '/pases', permisos: ['pases.registrar'], modulos: ['puntajes'] },
  { clave: 'comunicados', ruta: '/comunicados', permisos: ['comunicados.enviar'], modulos: ['comunicados'] },
  { clave: 'equipo', ruta: '/equipo', permisos: ['evento.miembros'], modulos: [] },
  { clave: 'configuracion', ruta: '/configuracion', permisos: ['evento.configurar'], modulos: [] },
  { clave: 'auditoria', ruta: '/auditoria', permisos: ['auditoria.ver'], modulos: [] },
] as const satisfies readonly { clave: string; ruta: string; permisos: readonly string[]; modulos: readonly Modulo[] }[];

/** Sección habilitada por la instancia: sin módulos asociados o con alguno activo (TR-39). */
export const seccionActiva = (s: (typeof SECCIONES_GESTION)[number]): boolean => habilitado(s.modulos);

export type SeccionGestion = (typeof SECCIONES_GESTION)[number]['clave'];

/** Sesión, evento y verificación de permiso de la sección; si no corresponde, vuelve al panel. */
export async function contextoGestion(eventoId: string, seccion: SeccionGestion) {
  const { sesion, db } = await requerirSesion();
  const definicion = SECCIONES_GESTION.find((s) => s.clave === seccion)!;
  if (!seccionActiva(definicion)) notFound();
  if (!definicion.permisos.some((p) => tienePermiso(sesion, eventoId, p))) {
    redirect({ href: '/panel', locale: await getLocale() });
  }
  const evento = await eventoDeGestion(db, eventoId);
  if (!evento) notFound();
  const puede = (permiso: string) => tienePermiso(sesion, eventoId, permiso);
  return { sesion, db, evento, puede, defecto: evento.idioma_defecto as Idioma };
}
