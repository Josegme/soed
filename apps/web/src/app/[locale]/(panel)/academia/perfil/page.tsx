import { CampoTexto, EncabezadoPagina, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { PestanasAcademia } from '@/components/panel/pestanas-academia';
import { redirect } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearFecha } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { academiaActiva, datosAcademia, equipoDeAcademia } from '@/modules/academias/infrastructure/consultas';
import { invitarProfesorAccion, revocarInvitacionAccion } from '@/modules/academias/interface/acciones';
import { FormularioAcademia } from '@/modules/academias/interface/formularios';

/** Perfil de la academia (PR-03) y su equipo de profesores con invitaciones (PR-04). */
export default async function PerfilAcademia({ params }: { params: Promise<{ locale: string }> }) {
  const locale = idiomaDe((await params).locale);
  const { sesion, db } = await requerirSesion();
  const activa = academiaActiva(sesion);
  if (!activa) redirect({ href: '/academia', locale });
  const t = await getTranslations('academia');
  const te = await getTranslations('academia.equipo');
  const tc = await getTranslations('comun');
  const [datos, equipo] = activa ? await Promise.all([datosAcademia(db, activa.id), equipoDeAcademia(db, activa.id)]) : [null, null];
  const titular = activa?.rol === 'TITULAR';
  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={activa?.nombre ?? t('titulo')} />
      <PestanasAcademia activa="perfil" />
      {datos ? <FormularioAcademia academia={datos} /> : null}
      {activa && equipo ? (
        <section aria-labelledby="titulo-equipo" className="flex max-w-2xl flex-col gap-3">
          <h2 id="titulo-equipo" className="font-display text-xl font-bold">
            {te('titulo')}
          </h2>
          <ul className="flex flex-col gap-2">
            {equipo.miembros.map((m) => (
              <li
                key={m.usuario_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde bg-superficie px-4 py-3"
              >
                <span>
                  <span className="font-medium">{m.nombre || m.email}</span>
                  {m.nombre ? <span className="block text-xs text-texto-suave">{m.email}</span> : null}
                </span>
                <Insignia tono={m.rol === 'TITULAR' ? 'marca' : 'neutro'}>{te(`roles.${m.rol as 'TITULAR'}`)}</Insignia>
              </li>
            ))}
            {equipo.invitaciones.map((i) => (
              <li
                key={i.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-borde px-4 py-3"
              >
                <span>
                  <span className="font-medium">{i.email}</span>
                  <span className="block text-xs text-texto-suave">
                    {te('pendiente', { vence: formatearFecha(i.vence_at.slice(0, 10), locale) })}
                  </span>
                </span>
                {titular ? (
                  <FormularioAccion
                    accion={revocarInvitacionAccion}
                    namespace="academia.equipo"
                    boton={te('revocar')}
                    variante="fantasma"
                    tamano="chico"
                    enLinea
                  >
                    <input type="hidden" name="invitacionId" value={i.id} />
                  </FormularioAccion>
                ) : null}
              </li>
            ))}
          </ul>
          {titular ? (
            <Tarjeta>
              <FormularioAccion accion={invitarProfesorAccion} namespace="academia.equipo" boton={te('invitar')} enLinea>
                <input type="hidden" name="academiaId" value={activa.id} />
                <div className="min-w-64 flex-1">
                  <CampoTexto
                    name="email"
                    type="email"
                    etiqueta={te('email')}
                    ayuda={te('ayuda')}
                    requerido
                    textoRequerido={tc('requerido')}
                    autoComplete="off"
                  />
                </div>
              </FormularioAccion>
            </Tarjeta>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
