'use client';

import { Link, usePathname } from '@/i18n/navigation';

export interface Pestana {
  href: string;
  etiqueta: string;
  /** Coincidencia exacta (la pestaña raíz no debe quedar activa en las subrutas). */
  exacta?: boolean;
}

/** Pestañas de sección con aria-current según la ruta actual. */
export function Pestanas({ pestanas, etiqueta }: { pestanas: readonly Pestana[]; etiqueta: string }) {
  const actual = usePathname();
  return (
    <nav aria-label={etiqueta} className="-mx-1 flex gap-1 overflow-x-auto border-b border-borde">
      {pestanas.map((p) => {
        const activa = p.exacta ? actual === p.href : actual === p.href || actual.startsWith(`${p.href}/`);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? 'page' : undefined}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-texto-suave hover:text-texto aria-[current=page]:border-marca aria-[current=page]:text-texto"
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
