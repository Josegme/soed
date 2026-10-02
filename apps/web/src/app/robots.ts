import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { urlSitio } from '@/lib/entorno';
import { PREFIJO_URL } from '@/lib/i18n/locales';

const PRIVADAS = ['panel', 'academia', 'gestion', 'admin', 'jurado', 'vivo', 'acreditacion', 'invitacion', 'sin-conexion'];

/** Solo producción se indexa; previews y desarrollo quedan fuera de los buscadores (PU-12). */
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== 'production') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', ...routing.locales.flatMap((l) => PRIVADAS.map((p) => `${PREFIJO_URL[l]}/${p}`))],
    },
    sitemap: `${urlSitio()}/sitemap.xml`,
  };
}
