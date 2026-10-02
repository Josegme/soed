import type { MetadataRoute } from 'next';
import { routing } from '@/i18n/routing';
import { urlSitio } from '@/lib/entorno';
import { ETIQUETA_LANG, PREFIJO_URL } from '@/lib/i18n/locales';
import { moduloOn } from '@/lib/modulos';
import { listarEventosPublicos } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';

export const revalidate = 3600;

/** Una entrada por ruta pública con sus alternativas por idioma (hreflang, PU-12). */
function entrada(ruta: string, modificado?: string): MetadataRoute.Sitemap[number] {
  const base = urlSitio();
  return {
    url: `${base}${PREFIJO_URL[routing.defaultLocale]}${ruta}`,
    lastModified: modificado,
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [ETIQUETA_LANG[l], `${base}${PREFIJO_URL[l]}${ruta}`])) },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const eventos = await listarEventosPublicos(repositorioEventosPublicos(), new Date()).catch(() => []);
  return [
    entrada(''),
    entrada('/eventos'),
    entrada('/legal/terminos'),
    entrada('/legal/privacidad'),
    ...eventos.flatMap((e) => {
      const ruta = `/eventos/${e.slug.toLowerCase()}`;
      return [
        entrada(ruta),
        ...(e.ordenPublicado && moduloOn('ordenEnVivo') ? [entrada(`${ruta}/orden`)] : []),
        ...(e.resultadosPublicados && moduloOn('puntajes') ? [entrada(`${ruta}/resultados`)] : []),
      ];
    }),
  ];
}
