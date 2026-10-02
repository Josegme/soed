import type { ReactNode } from 'react';
import { exigirModulo } from '@/lib/modulos';

/** Vistas en vivo (OP-*): solo si la instancia tiene el módulo activo (TR-39). */
export default function LayoutModulo({ children }: { children: ReactNode }) {
  exigirModulo('ordenEnVivo');
  return children;
}
