import type { EstadoEvento, Idioma } from '@soed/domain';
import { EncabezadoPagina, Insignia } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Pestanas } from '@/components/panel/pestanas';
import { Link } from '@/i18n/navigation';
import { tienePermiso } from '@/lib/auth/sesion';
import { formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { contextoGestion, seccionActiva, SECCIONES_GESTION } from '@/modules/gestion/interface/contexto';

export default async function LayoutGestion({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string; eventoId: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma = idiomaDe(locale);
  const { sesion, evento, defecto } = await contextoGestion(eventoId, 'resumen');
  const t = await getTranslations('gestion');
  const te = await getTranslations('estados.evento');
  const pestanas = SECCIONES_GESTION.filter((s) => seccionActiva(s) && s.permisos.some((p) => tienePermiso(sesion, eventoId, p))).map(
    (s) => ({
      href: `/gestion/${eventoId}${s.ruta}`,
      etiqueta: t(`secciones.${s.clave}`),
      exacta: s.ruta === '',
    }),
  );
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={texto(evento.nombre, idioma, defecto as Idioma)}
        descripcion={`${evento.slug} · ${formatearRangoFechas(evento.fecha_inicio, evento.fecha_fin, idioma)}`}
        acciones={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Insignia tono={evento.publicado ? 'exito' : 'neutro'}>{te(evento.estado as EstadoEvento)}</Insignia>
            {evento.publicado ? (
              <Link
                href={`/eventos/${evento.slug.toLowerCase()}`}
                className="text-sm font-medium text-marca underline-offset-4 hover:underline"
              >
                {t('verPublico')}
              </Link>
            ) : null}
          </div>
        }
      />
      <Pestanas pestanas={pestanas} etiqueta={t('secciones.titulo')} />
      <div>{children}</div>
    </div>
  );
}
