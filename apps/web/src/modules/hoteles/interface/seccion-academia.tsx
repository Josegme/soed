import type { Idioma } from '@soed/domain';
import { CampoTexto, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearMonto } from '@/lib/i18n/formato';
import { texto } from '@/lib/i18n/traducible';
import type { hotelesDeAcademia } from '../infrastructure/consultas';
import { cancelarSolicitudHotelAccion, solicitarHotelAccion } from './acciones';

/** Pedido de hotel o paquete de la academia con su prioridad vigente (PR-30). */
export async function SeccionHoteles({
  hoteles,
  inscripcionId,
  moneda,
  idioma,
  defecto,
}: {
  hoteles: Awaited<ReturnType<typeof hotelesDeAcademia>>;
  inscripcionId: string;
  moneda: string;
  idioma: Idioma;
  defecto: Idioma;
}) {
  if (hoteles.length === 0) return null;
  const t = await getTranslations('academia.inscripcion.hoteles');
  const tg = await getTranslations('gestion.hoteles');
  return (
    <section className="flex flex-col gap-3" aria-labelledby="hoteles">
      <h2 id="hoteles" className="font-display text-xl font-bold">
        {t('titulo')}
      </h2>
      <p className="max-w-prose text-sm text-texto-suave">{t('aclaracion')}</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {hoteles.map((h) => (
          <li key={h.id}>
            <Tarjeta className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-display text-lg font-bold">{h.nombre}</p>
                <Insignia tono="info">{tg(`criterios.${h.criterio}`)}</Insignia>
              </div>
              {texto(h.descripcion, idioma, defecto) ? (
                <p className="whitespace-pre-line text-sm text-texto-suave">{texto(h.descripcion, idioma, defecto)}</p>
              ) : null}
              {h.precio !== null ? <p className="text-sm">{t('precio', { precio: formatearMonto(h.precio, moneda, idioma) })}</p> : null}
              {h.solicitud ? (
                <p className="text-sm font-medium" role="status">
                  {t('estado', {
                    plazas: h.solicitud.plazas,
                    asignadas: h.solicitud.asignacion?.plazasAsignadas ?? 0,
                    espera: h.solicitud.asignacion?.enEspera ?? h.solicitud.plazas,
                  })}
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-end gap-3">
                <FormularioAccion
                  accion={solicitarHotelAccion}
                  namespace="academia.inscripcion.hoteles"
                  boton={h.solicitud ? t('actualizar') : t('solicitar')}
                  variante={h.solicitud ? 'secundario' : 'primario'}
                  tamano="chico"
                  enLinea
                >
                  <input type="hidden" name="hotelId" value={h.id} />
                  <input type="hidden" name="inscripcionId" value={inscripcionId} />
                  <CampoTexto
                    name="plazas"
                    type="number"
                    min={1}
                    max={200}
                    etiqueta={t('plazas')}
                    defaultValue={String(h.solicitud?.plazas ?? 1)}
                    className="w-28"
                  />
                </FormularioAccion>
                {h.solicitud ? (
                  <FormularioAccion
                    accion={cancelarSolicitudHotelAccion}
                    namespace="academia.inscripcion.hoteles"
                    boton={t('cancelar')}
                    variante="fantasma"
                    tamano="chico"
                    enLinea
                  >
                    <input type="hidden" name="solicitudId" value={h.solicitud.id} />
                  </FormularioAccion>
                ) : null}
              </div>
            </Tarjeta>
          </li>
        ))}
      </ul>
    </section>
  );
}
