import type { Idioma } from '@soed/domain';
import { Aviso, EncabezadoPagina, Insignia, Tabla, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RefrescoPeriodico } from '@/components/refresco-periodico';
import { formatearInstante } from '@/lib/i18n/formato';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { agruparOrden, obtenerEventoPublico } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { idiomaDe } from '@/lib/i18n/locales';

export const revalidate = 15;

export default async function OrdenPublico({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { slug } = await params;
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const repo = repositorioEventosPublicos();
  const evento = await obtenerEventoPublico(repo, slug, new Date());
  if (!evento) notFound();
  const t = await getTranslations('eventos');
  const te = await getTranslations('estados.orden');
  const grupos = evento.ordenPublicado ? agruparOrden(await repo.ordenPublico(evento.slug)) : [];
  const defecto = evento.idiomaDefecto as Idioma;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t('orden')} descripcion={texto(evento.nombre, locale, defecto)} acciones={<Insignia tono="info">{t('actualizacionVivo')}</Insignia>} />
      <RefrescoPeriodico segundos={20} />
      {grupos.length === 0 ? <Aviso tono="info">{t('ordenNoPublicado')}</Aviso> : null}
      {grupos.map((g) => (
        <section key={g.clave} className="flex flex-col gap-3" aria-label={`${texto(g.pista, locale, defecto)} — ${texto(g.bloque, locale, defecto)}`}>
          <h2 className="font-display text-xl font-bold">
            {texto(g.pista, locale, defecto)} · {texto(g.bloque, locale, defecto)}
            {g.inicioProgramado ? (
              <span className="ml-2 text-base font-medium text-texto-suave">{formatearInstante(g.inicioProgramado, locale, evento.zonaHoraria, { timeStyle: 'short' })}</span>
            ) : null}
          </h2>
          <Tabla>
            <thead>
              <tr>
                <Th className="w-14">{t('posicion')}</Th>
                <Th>{t('coreografia')}</Th>
                <Th>{t('academia')}</Th>
                <Th>{t('categoria')}</Th>
                <Th>{t('genero')}</Th>
                <Th>{t('formacion')}</Th>
              </tr>
            </thead>
            <tbody>
              {g.filas.map((f) => (
                <tr key={`${f.posicion}-${f.coreografia}`} className={f.estado === 'EN_ESCENA' ? 'bg-acento/15' : undefined}>
                  <Td className="tabular-nums">{f.posicion}</Td>
                  <Td>
                    <span className="font-semibold">{f.coreografia}</span>
                    {f.estado !== 'PROGRAMADA' ? (
                      <span className="ml-2">
                        <Insignia tono={f.estado === 'EN_ESCENA' ? 'marca' : 'neutro'}>{te(f.estado)}</Insignia>
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    {f.academia}
                    {f.ciudad ? <span className="text-texto-suave"> · {f.ciudad}</span> : null}
                  </Td>
                  <Td>{nombreCodigo(evento.reglamento, 'categorias', f.categoria, locale)}</Td>
                  <Td>{nombreCodigo(evento.reglamento, 'generos', f.genero, locale)}</Td>
                  <Td>{nombreCodigo(evento.reglamento, 'formaciones', f.formacion, locale)}</Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        </section>
      ))}
    </div>
  );
}
