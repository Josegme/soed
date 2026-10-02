import type { Idioma } from '@soed/domain';
import { EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { modoEmail } from '@/lib/entorno';
import { formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { enviarComunicadoAccion } from '@/modules/comunicaciones/interface/acciones';
import { comunicadosDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

const AUDIENCIAS = ['ACADEMIAS', 'JURADOS', 'STAFF'] as const;

/** Comunicados bilingües: cada persona los recibe en el idioma de su perfil (OR-47, TR-21). */
export default async function ComunicadosGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, defecto } = await contextoGestion(eventoId, 'comunicados');
  const comunicados = await comunicadosDeGestion(db, eventoId);
  const t = await getTranslations('gestion.comunicados');
  const tc = await getTranslations('comun');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_28rem]">
      <section aria-labelledby="titulo-historial" className="flex flex-col gap-3">
        <h2 id="titulo-historial" className="font-display text-xl font-bold">
          {t('historial')}
        </h2>
        {comunicados.length === 0 ? <EstadoVacio titulo={t('sinComunicados')} /> : null}
        <ul className="flex flex-col gap-3">
          {comunicados.map((c) => (
            <li key={c.id}>
              <Tarjeta className="flex flex-col gap-2">
                <p className="font-semibold">{texto(c.asunto, idioma, defecto)}</p>
                <p className="text-xs text-texto-suave">
                  {formatearInstante(c.enviado_at ?? c.creado_at, idioma, evento.zona_horaria)} ·{' '}
                  {c.audiencia.map((a) => t(`audiencia.${a as (typeof AUDIENCIAS)[number]}`)).join(', ')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(c.envios).map(([estado, cantidad]) => (
                    <Insignia key={estado} tono={estado === 'FALLIDO' ? 'error' : estado === 'ENVIADO' ? 'exito' : 'neutro'}>
                      {t(`envio.${estado as 'PENDIENTE' | 'ENVIADO' | 'FALLIDO' | 'SIMULADO'}`, { cantidad })}
                    </Insignia>
                  ))}
                </div>
              </Tarjeta>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-labelledby="titulo-nuevo-comunicado">
        <Tarjeta className="flex flex-col gap-4">
          <h2 id="titulo-nuevo-comunicado" className="font-display text-lg font-bold">
            {t('nuevo')}
          </h2>
          {modoEmail() === 'sink' ? <p className="text-sm text-texto-suave">{t('modoSimulado')}</p> : null}
          <FormularioAccion accion={enviarComunicadoAccion} namespace="gestion.comunicados" boton={tc('enviar')}>
            <input type="hidden" name="eventoId" value={eventoId} />
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">{t('destinatarios')}</legend>
              {AUDIENCIAS.map((a) => (
                <label key={a} className="flex min-h-11 items-center gap-3 text-sm">
                  <input type="checkbox" name="audiencia" value={a} defaultChecked={a === 'ACADEMIAS'} className="size-5 accent-marca" />
                  {t(`audiencia.${a}`)}
                </label>
              ))}
            </fieldset>
            <CamposTraducibles
              nombre="asunto"
              etiqueta={t('asunto')}
              requerido
              textoRequerido={tc('requerido')}
              maxLength={200}
              columnas={false}
            />
            <CamposTraducibles
              nombre="cuerpo"
              etiqueta={t('cuerpo')}
              requerido
              textoRequerido={tc('requerido')}
              maxLength={20000}
              ayuda={t('ayudaTraduccion')}
              area
            />
          </FormularioAccion>
        </Tarjeta>
      </aside>
    </div>
  );
}
