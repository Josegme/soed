import type { ReactNode } from 'react';
import { exigirModulo } from '@/lib/modulos';

/** Planilla del jurado (JU-*): solo si la instancia tiene el módulo activo (TR-39). */
export default function LayoutModulo({ children }: { children: ReactNode }) {
  exigirModulo('puntajes');
  return children;
}
