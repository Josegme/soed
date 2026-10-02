import type { ReactNode } from 'react';
import { Cabecera } from '@/components/cabecera';
import { Pie } from '@/components/pie';

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return (
    <>
      <Cabecera />
      <main id="contenido" className="flex-1">
        {children}
      </main>
      <Pie />
    </>
  );
}
