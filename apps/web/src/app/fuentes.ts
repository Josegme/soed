import { Bricolage_Grotesque, Figtree } from 'next/font/google';

/** Figtree para interfaz y tablas (legible, cubre portugués y español). */
export const fuenteTexto = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--fuente-texto', display: 'swap' });

/** Bricolage Grotesque para títulos: carácter de afiche de festival. */
export const fuenteDisplay = Bricolage_Grotesque({
  subsets: ['latin', 'latin-ext'],
  variable: '--fuente-display',
  display: 'swap',
  weight: ['600', '700', '800'],
});
