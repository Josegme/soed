import type { ReactNode } from 'react';
import { exigirModulo } from '@/lib/modulos';

/** Acreditación y caja (OP-17 a OP-25): solo si la instancia tiene el módulo activo (TR-39). */
export default function LayoutModulo({ children }: { children: ReactNode }) {
  exigirModulo('acreditacion');
  return children;
}
