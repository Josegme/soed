import type { Idioma } from '@soed/domain';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { formatearRangoFechas } from '@/lib/i18n/formato';
import { texto } from '@/lib/i18n/traducible';
import type { EventoPublicoConVentana } from '@/modules/eventos/application/eventos-publicos';
import { FechaEvento } from './fecha-evento';
import { InsigniaVentana } from './insignia-ventana';

export async function TarjetaEvento({ evento, idioma }: { evento: EventoPublicoConVentana; idioma: Idioma }) {
  const t = await getTranslations('eventos');
  const lugar = [evento.sede.ciudad, evento.sede.region, evento.sede.pais].filter(Boolean).join(', ');
  return (
    <li className="relative flex gap-4 rounded-[var(--radio)] border border-borde bg-superficie p-4 transition-colors hover:border-marca/50">
      <FechaEvento fecha={evento.fechaInicio} idioma={idioma} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs font-semibold text-texto-suave">{t(`tipo.${evento.tipo}`)}</p>
        <h3 className="font-display text-lg font-bold leading-snug text-texto">
          <Link href={`/eventos/${evento.slug.toLowerCase()}`} className="after:absolute after:inset-0 focus-visible:underline">
            {texto(evento.nombre, idioma, evento.idiomaDefecto as Idioma)}
          </Link>
        </h3>
        <p className="text-sm text-texto-suave">
          {formatearRangoFechas(evento.fechaInicio, evento.fechaFin, idioma)}
          {lugar ? ` · ${lugar}` : null}
        </p>
        <div className="mt-1">
          <InsigniaVentana ventana={evento.ventana} />
        </div>
      </div>
    </li>
  );
}
