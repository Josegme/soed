import type { Idioma } from '@soed/domain';
import { Aviso, EncabezadoPagina, Insignia, Tabla, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { formatearPuntaje } from '@/lib/i18n/formato';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { obtenerEventoPublico } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { idiomaDe } from '@/lib/i18n/locales';
import { exigirModulo } from '@/lib/modulos';

export const revalidate = 60;

export default async function ResultadosPublicos({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  exigirModulo('puntajes');
  const { slug } = await params;
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const repo = repositorioEventosPublicos();
  const evento = await obtenerEventoPublico(repo, slug, new Date());
  if (!evento) notFound();
  const t = await getTranslations('eventos');
  const filas = evento.resultadosPublicados ? await repo.resultadosPublicos(evento.slug) : [];
  const grupos = new Map<string, typeof filas>();
  for (const f of filas) grupos.set(f.grupo, [...(grupos.get(f.grupo) ?? []), f]);
  const defecto = evento.idiomaDefecto as Idioma;
  const decimales = evento.reglamento?.puntaje?.decimalesResultado ?? 2;
  const nombreBanda = (codigo: string | null) =>
    codigo ? texto(evento.reglamento?.bandas?.find((b) => b.codigo === codigo)?.nombre, locale) || codigo : '';

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6">
      <EncabezadoPagina titulo={t('resultados')} descripcion={texto(evento.nombre, locale, defecto)} />
      {filas.length === 0 ? <Aviso tono="info">{t('resultadosNoPublicados')}</Aviso> : null}
      {[...grupos].map(([grupo, lista]) => {
        const muestra = lista[0];
        const titulo = muestra
          ? [
              nombreCodigo(evento.reglamento, 'categorias', muestra.categoria, locale),
              nombreCodigo(evento.reglamento, 'formaciones', muestra.formacion, locale),
              nombreCodigo(evento.reglamento, 'generos', muestra.genero, locale),
            ]
              .filter(Boolean)
              .join(' · ')
          : grupo;
        return (
          <section key={grupo} className="flex flex-col gap-3" aria-label={titulo}>
            <h2 className="font-display text-xl font-bold">{titulo}</h2>
            <Tabla>
              <thead>
                <tr>
                  <Th className="w-20">{t('puesto')}</Th>
                  <Th>{t('coreografia')}</Th>
                  <Th>{t('academia')}</Th>
                  <Th className="text-right">{t('puntaje')}</Th>
                  <Th>{t('clasificacion')}</Th>
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={`${f.puesto}-${f.coreografia}`}>
                    <Td className="font-display text-lg font-bold tabular-nums">{f.puesto}</Td>
                    <Td className="font-semibold">{f.coreografia}</Td>
                    <Td>{f.academia}</Td>
                    <Td className="text-right tabular-nums">{formatearPuntaje(f.puntaje, locale, decimales)}</Td>
                    <Td>{f.banda ? <Insignia tono="marca">{nombreBanda(f.banda)}</Insignia> : null}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          </section>
        );
      })}
    </div>
  );
}
