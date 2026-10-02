import type { Idioma } from '@soed/domain';
import { EncabezadoPagina, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { Link, redirect } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearDuracion } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo } from '@/lib/i18n/traducible';
import { academiaActiva, listarBailarines, listarCoreografias, reglamentoDeReferencia } from '@/modules/academias/infrastructure/consultas';
import { FormularioCoreografia } from '@/modules/academias/interface/formularios';

export default async function Coreografias({ params }: { params: Promise<{ locale: string }> }) {
  const locale: Idioma = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const academia = academiaActiva(sesion);
  if (!academia) {
    redirect({ href: '/academia', locale });
    return null;
  }
  const t = await getTranslations('academia.coreografias');
  const [coreografias, bailarines, reglamento] = await Promise.all([
    listarCoreografias(db, academia.id),
    listarBailarines(db, academia.id),
    reglamentoDeReferencia(db),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={t('descripcion')} />
      <PestanasAcademia activa="coreografias" />
      <div className="grid gap-6 xl:grid-cols-[1fr_28rem]">
        <section aria-label={t('titulo')}>
          {coreografias.length === 0 ? <EstadoVacio titulo={t('sinCoreografias')} /> : null}
          <ul className="grid gap-3 md:grid-cols-2">
            {coreografias.map((c) => (
              <li key={c.id}>
                <Tarjeta className="flex h-full flex-col gap-2">
                  <p className="font-display text-lg font-bold">{c.nombre}</p>
                  <p className="text-sm text-texto-suave">
                    {nombreCodigo(reglamento, 'generos', c.genero, locale)} · {nombreCodigo(reglamento, 'formaciones', c.formacion, locale)} ·{' '}
                    {t('integrantes', { cantidad: c.coreografia_bailarin.length })}
                  </p>
                  <div>
                    {c.musica_duracion_seg ? (
                      <Insignia tono="exito">{formatearDuracion(c.musica_duracion_seg)}</Insignia>
                    ) : (
                      <Insignia tono="alerta">{t('sinMusica')}</Insignia>
                    )}
                  </div>
                  <Link href={`/academia/coreografias/${c.id}`} className="mt-auto font-semibold text-marca underline-offset-4 hover:underline">
                    {t('editar')}
                  </Link>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
        <Tarjeta className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-bold">{t('nueva')}</h2>
          <FormularioCoreografia
            academiaId={academia.id}
            reglamento={reglamento}
            bailarines={bailarines.filter((b) => b.activo).map((b) => ({ id: b.id, nombre: `${b.apellido}, ${b.nombre}` }))}
          />
        </Tarjeta>
      </div>
    </div>
  );
}
