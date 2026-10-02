import type { Idioma, Traducible } from '@soed/domain';
import { EstadoVacio } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import QRCode from 'qrcode';
import { cliente } from '@/cliente';
import { BotonImprimir } from '@/components/boton-imprimir';
import { requerirPermiso } from '@/lib/auth/sesion';
import { libre } from '@/lib/i18n/claves';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { credencialesDelEvento } from '@/modules/acreditacion/infrastructure/consultas';

/** Credenciales imprimibles con QR (OR-50): el QR lleva solo el token, sin datos personales. */
export default async function Credenciales({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ academia?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db } = await requerirPermiso(eventoId, 'acreditacion.operar');
  const { data: evento } = await db.from('evento').select('nombre, idioma_defecto').eq('id', eventoId).maybeSingle();
  if (!evento) notFound();
  const credenciales = (await credencialesDelEvento(db, eventoId, { academiaId: (await searchParams).academia })).filter((c) => !c.anulada);
  const qrs = await Promise.all(credenciales.map((c) => QRCode.toString(c.qrToken, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })));
  const t = await getTranslations('acreditacion');
  const tt = libre(await getTranslations('acreditacion.tipos'));
  const nombreEvento = texto(evento.nombre as Traducible, idioma, evento.idioma_defecto as Idioma);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="font-display text-2xl font-bold">{t('imprimir')}</h1>
        <BotonImprimir etiqueta={t('imprimirAhora')} />
      </div>
      {credenciales.length === 0 ? <EstadoVacio titulo={t('sinCredenciales')} /> : null}
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {credenciales.map((c, i) => (
          <li
            key={c.id}
            className="flex break-inside-avoid gap-4 rounded-[var(--radio)] border border-borde bg-superficie p-4 print:rounded-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG generado en el servidor */}
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(qrs[i]!)}`}
              alt={t('qrDe', { nombre: c.nombre })}
              width={112}
              height={112}
              className="size-28 shrink-0"
            />
            <div className="flex min-w-0 flex-col gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo SVG de la instancia */}
              <img src={cliente.marca.logo} alt={cliente.marca.logoAlt} width={110} height={24} className="h-6 w-auto self-start" />
              <p className="text-xs text-texto-suave">{nombreEvento}</p>
              <p className="font-display text-lg font-bold leading-tight">{c.nombre}</p>
              <p className="text-sm">{tt.has(c.tipo) ? tt(c.tipo) : c.tipo}</p>
              {c.academia ? <p className="truncate text-sm text-texto-suave">{c.academia}</p> : null}
              {c.zonas.length > 0 ? <p className="text-xs text-texto-suave">{c.zonas.join(' · ')}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
