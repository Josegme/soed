import { Aviso, EncabezadoPagina, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { requerirSesion } from '@/lib/auth/sesion';
import { aceptarInvitacionAccion } from '@/modules/academias/interface/acciones';

/** Aceptación de una invitación a una academia (PR-04). Exige la cuenta del email invitado. */
export default async function AceptarInvitacion({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { token } = await params;
  const { db, sesion } = await requerirSesion(`/invitacion/${token}`);
  const t = await getTranslations('academia.equipo');
  const { data } = await db.rpc('ver_invitacion', { p_token: token });
  const invitacion = data?.[0];
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-12">
      <EncabezadoPagina titulo={t('aceptarTitulo')} />
      {!invitacion ? (
        <Aviso tono="error">{t('noEncontrada')}</Aviso>
      ) : invitacion.aceptada ? (
        <Aviso tono="info">{t('yaUsada')}</Aviso>
      ) : invitacion.vencida ? (
        <Aviso tono="alerta">{t('vencida')}</Aviso>
      ) : (
        <Tarjeta className="flex flex-col gap-4">
          <p>{t('aceptarDescripcion', { academia: invitacion.academia, email: sesion.email })}</p>
          <FormularioAccion accion={aceptarInvitacionAccion} namespace="academia.equipo" boton={t('aceptar')}>
            <input type="hidden" name="token" value={token} />
          </FormularioAccion>
        </Tarjeta>
      )}
    </div>
  );
}
