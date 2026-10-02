import { EncabezadoPagina } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { redirect } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { idiomaDe } from '@/lib/i18n/locales';
import { academiaActiva, datosAcademia } from '@/modules/academias/infrastructure/consultas';
import { FormularioAcademia } from '@/modules/academias/interface/formularios';

export default async function PerfilAcademia({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const activa = academiaActiva(sesion);
  if (!activa) redirect({ href: '/academia', locale });
  const t = await getTranslations('academia');
  const datos = activa ? await datosAcademia(db, activa.id) : null;
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={activa?.nombre ?? t('titulo')} />
      <PestanasAcademia activa="perfil" />
      {datos ? <FormularioAcademia academia={datos} /> : null}
    </div>
  );
}
