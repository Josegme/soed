import { cn, estilosBoton } from '@soed/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { TarjetaEvento } from '@/components/tarjeta-evento';
import { Link } from '@/i18n/navigation';
import { supabaseConfigurado } from '@/lib/entorno';
import { listarEventosPublicos } from '@/modules/eventos/application/eventos-publicos';
import { repositorioEventosPublicos } from '@/modules/eventos/infrastructure/repositorio-publico-supabase';
import { idiomaDe } from '@/lib/i18n/locales';

export const revalidate = 300;

export default async function Inicio({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  setRequestLocale(locale);
  const t = await getTranslations('inicio');
  const eventos = (await listarEventosPublicos(repositorioEventosPublicos(), new Date())).slice(0, 4);
  const pasos = [1, 2, 3, 4] as const;

  return (
    <>
      <section className="relative overflow-hidden bg-marca text-marca-contraste">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-40 size-[34rem] rounded-full bg-[radial-gradient(circle,var(--acento)_0%,transparent_65%)] opacity-35"
        />
        <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <h1 className="max-w-3xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">{t('titulo')}</h1>
          <p className="max-w-2xl text-lg opacity-90">{t('subtitulo')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/registro" className={estilosBoton({ variante: 'acento', tamano: 'grande' })}>
              {t('ctaInscribir')}
            </Link>
            <Link
              href="/eventos"
              className={cn(
                estilosBoton({ variante: 'fantasma', tamano: 'grande' }),
                'text-marca-contraste ring-1 ring-marca-contraste/50 hover:bg-marca-contraste/10',
              )}
            >
              {t('ctaEventos')}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="proximos">
        <h2 id="proximos" className="mb-6 font-display text-2xl font-bold">
          {t('proximos')}
        </h2>
        {eventos.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {eventos.map((e) => (
              <TarjetaEvento key={e.id} evento={e} idioma={locale} />
            ))}
          </ul>
        ) : (
          <p className="text-texto-suave">{supabaseConfigurado() ? t('sinEventos') : t('sinConexion')}</p>
        )}
      </section>

      <section className="border-y border-borde bg-superficie" aria-labelledby="pasos">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 id="pasos" className="mb-8 font-display text-2xl font-bold">
            {t('pasosTitulo')}
          </h2>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pasos.map((n) => (
              <li key={n} className="flex flex-col gap-2">
                <span
                  className="flex size-9 items-center justify-center rounded-full bg-acento font-display font-bold text-acento-contraste"
                  aria-hidden
                >
                  {n}
                </span>
                <h3 className="font-semibold">{t(`paso${n}Titulo`)}</h3>
                <p className="text-sm text-texto-suave">{t(`paso${n}`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
