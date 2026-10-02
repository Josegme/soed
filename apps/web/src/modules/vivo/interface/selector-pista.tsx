import type { Idioma, Traducible } from '@soed/domain';
import { Link } from '@/i18n/navigation';
import { texto } from '@/lib/i18n/traducible';

/** Pestañas de pista cuando el evento tiene más de una (OP-09). */
export function SelectorPista({
  pistas,
  actual,
  ruta,
  idioma,
  defecto,
  etiqueta,
}: {
  pistas: readonly { id: string; nombre: Traducible }[];
  actual: string | undefined;
  ruta: string;
  idioma: Idioma;
  defecto: Idioma;
  etiqueta: string;
}) {
  if (pistas.length < 2) return null;
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap gap-2">
      {pistas.map((p) => (
        <Link
          key={p.id}
          href={`${ruta}?pista=${p.id}`}
          aria-current={p.id === actual ? 'page' : undefined}
          className="min-h-11 rounded-full border border-borde px-4 py-2 text-sm font-medium aria-[current=page]:border-marca aria-[current=page]:bg-marca aria-[current=page]:text-marca-contraste"
        >
          {texto(p.nombre, idioma, defecto)}
        </Link>
      ))}
    </nav>
  );
}
