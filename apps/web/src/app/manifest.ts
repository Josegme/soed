import type { MetadataRoute } from 'next';
import { cliente } from '@/cliente';
import { PREFIJO_URL } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';

/** Manifest de la PWA instalable (PU-14), con la marca de la instancia. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: cliente.nombre,
    short_name: cliente.nombreCorto,
    description: texto(cliente.descripcion, cliente.idiomaDefecto),
    lang: cliente.idiomaDefecto,
    start_url: `${PREFIJO_URL[cliente.idiomaDefecto]}/panel`,
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: cliente.marca.colorTema,
    icons: [{ src: cliente.marca.favicon, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
