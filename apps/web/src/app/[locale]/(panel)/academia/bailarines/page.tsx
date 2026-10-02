import { edadCumplida, fechaISO, type FechaISO } from '@soed/domain';
import { EncabezadoPagina, EstadoVacio, Insignia, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { redirect } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearFecha } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { academiaActiva, listarBailarines } from '@/modules/academias/infrastructure/consultas';
import { BotonActivoBailarin, FormularioBailarin } from '@/modules/academias/interface/formularios';

export default async function Bailarines({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const academia = academiaActiva(sesion);
  if (!academia) {
    redirect({ href: '/academia', locale });
    return null;
  }
  const t = await getTranslations('academia.bailarines');
  const tc = await getTranslations('comun');
  const bailarines = await listarBailarines(db, academia.id);
  const hoy = fechaISO(new Date().toISOString().slice(0, 10));
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={t('descripcion')} />
      <PestanasAcademia activa="bailarines" />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section aria-label={t('titulo')}>
          {bailarines.length === 0 ? (
            <EstadoVacio titulo={t('sinBailarines')} />
          ) : (
            <Tabla>
              <thead>
                <tr>
                  <Th>{tc('nombre')}</Th>
                  <Th>{t('fechaNacimiento')}</Th>
                  <Th className="text-right">{t('edadHoy')}</Th>
                  <Th>
                    <span className="sr-only">{tc('acciones')}</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {bailarines.map((b) => (
                  <tr key={b.id} className={b.activo ? undefined : 'opacity-60'}>
                    <Td className="font-medium">
                      {b.apellido}, {b.nombre} {b.activo ? null : <Insignia>{t('inactivo')}</Insignia>}
                    </Td>
                    <Td>{formatearFecha(b.fecha_nacimiento, locale, { dateStyle: 'medium' })}</Td>
                    <Td className="text-right tabular-nums">{edadCumplida(b.fecha_nacimiento as FechaISO, hoy)}</Td>
                    <Td className="text-right">
                      <BotonActivoBailarin bailarinId={b.id} activo={b.activo} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
        </section>
        <FormularioBailarin academiaId={academia.id} />
      </div>
    </div>
  );
}
