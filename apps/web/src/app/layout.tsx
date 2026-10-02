import type { ReactNode } from 'react';

/** Layout raíz de paso: el html/body los define app/[locale]/layout.tsx (next-intl). */
export default function LayoutRaiz({ children }: { children: ReactNode }) {
  return children;
}
