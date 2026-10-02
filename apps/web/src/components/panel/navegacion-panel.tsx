import type { Idioma } from '@soed/domain';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { eventosDeSesion } from '@/lib/auth/eventos-de-sesion';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { texto } from '@/lib/i18n/traducible';
import type { ClienteSupabase } from '@/lib/supabase/server';

interface Enlace {
  href: string;
  etiqueta: string;
}

const claseEnlace =
  'block rounded-md px-3 py-2 text-sm text-texto hover:bg-superficie-2 focus-visible:ring-[3px] focus-visible:ring-marca/60';

/** Menú derivado de permisos (ADR-0007): un rol nuevo no requiere tocar esta navegación. */
export async function NavegacionPanel({ sesion, db, idioma }: { sesion: Sesion; db: ClienteSupabase; idioma: Idioma }) {
  const t = await getTranslations('panel.nav');
  const eventos = await eventosDeSesion(db, sesion);
  const generales: Enlace[] = [{ href: '/academia', etiqueta: t('academia') }];
  if (sesion.esSuperAdmin) generales.push({ href: '/admin', etiqueta: t('admin') });

  const porEvento = eventos.map((e) => {
    const enlaces: Enlace[] = [];
    const puede = (p: string) => tienePermiso(sesion, e.id, p);
    if (puede('inscripciones.ver') || puede('evento.configurar')) enlaces.push({ href: `/gestion/${e.id}`, etiqueta: t('gestion') });
    if (puede('puntajes.cargar')) enlaces.push({ href: `/jurado/${e.id}`, etiqueta: t('jurado') });
    if (puede('puntajes.supervisar')) enlaces.push({ href: `/vivo/${e.id}/director-tecnico`, etiqueta: t('directorTecnico') });
    if (puede('orden.operar')) enlaces.push({ href: `/vivo/${e.id}/coordinador`, etiqueta: t('coordinador') });
    if (puede('orden.ver')) enlaces.push({ href: `/vivo/${e.id}/locutor`, etiqueta: t('locutor') });
    if (puede('musica.descargar')) enlaces.push({ href: `/vivo/${e.id}/dj`, etiqueta: t('dj') });
    if (puede('acreditacion.operar')) enlaces.push({ href: `/acreditacion/${e.id}`, etiqueta: t('acreditacion') });
    if (puede('cobros.registrar')) enlaces.push({ href: `/acreditacion/${e.id}/caja`, etiqueta: t('caja') });
    return { evento: e, enlaces };
  });

  return (
    <nav aria-label={t('titulo')} className="flex flex-col gap-5">
      <ul className="flex flex-col gap-0.5">
        {generales.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={claseEnlace}>
              {l.etiqueta}
            </Link>
          </li>
        ))}
      </ul>
      {porEvento
        .filter((p) => p.enlaces.length > 0)
        .map(({ evento, enlaces }) => (
          <div key={evento.id} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-semibold text-texto-suave">
              {texto(evento.nombre, idioma, evento.idiomaDefecto as Idioma)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {enlaces.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={claseEnlace}>
                    {l.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </nav>
  );
}
