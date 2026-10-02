import { getLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { eventosConPermiso, requerirSesion } from '@/lib/auth/sesion';

/** Destino según el rol: Super Admin → admin; staff → su evento; academias → su panel. */
export default async function Panel() {
  const { sesion } = await requerirSesion();
  const locale = await getLocale();
  const primero = (permiso: string) => eventosConPermiso(sesion, permiso)[0];
  const destinos: [string, (id: string) => string][] = [
    ['evento.configurar', (id) => `/gestion/${id}`],
    ['puntajes.supervisar', (id) => `/vivo/${id}/director-tecnico`],
    ['puntajes.cargar', (id) => `/jurado/${id}`],
    ['orden.operar', (id) => `/vivo/${id}/coordinador`],
    ['musica.descargar', (id) => `/vivo/${id}/dj`],
    ['orden.ver', (id) => `/vivo/${id}/locutor`],
    ['acreditacion.operar', (id) => `/acreditacion/${id}`],
  ];
  let destino = sesion.esSuperAdmin ? '/admin' : '/academia';
  if (!sesion.esSuperAdmin) {
    for (const [permiso, ruta] of destinos) {
      const id = primero(permiso);
      if (id) {
        destino = ruta(id);
        break;
      }
    }
  }
  redirect({ href: destino, locale });
}
