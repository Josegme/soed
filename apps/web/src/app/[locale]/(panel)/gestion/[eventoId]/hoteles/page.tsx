import type { Idioma } from '@soed/domain';
import { EstadoVacio, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import { hotelesDeGestion } from '@/modules/hoteles/infrastructure/consultas';
import { eliminarHotelAccion } from '@/modules/hoteles/interface/acciones';
import { FormularioHotel } from '@/modules/hoteles/interface/formulario-hotel';

/** Hoteles y paquetes con la prioridad de asignación vigente (OR-09, OR-54). */
export default async function HotelesGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede, defecto } = await contextoGestion(eventoId, 'hoteles');
  const hoteles = await hotelesDeGestion(db, eventoId);
  const t = await getTranslations('gestion.hoteles');
  const configura = puede('evento.configurar');
  const fecha = (instante: string | null) =>
    instante ? formatearInstante(instante, idioma, evento.zona_horaria, { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-prose text-sm text-texto-suave">{t('aclaracion')}</p>
      {hoteles.length === 0 ? <EstadoVacio titulo={t('sinHoteles')} /> : null}
      {hoteles.map((h) => (
        <Tarjeta key={h.id} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="font-display text-lg font-bold">{h.nombre}</h2>
              {texto(h.descripcion, idioma, defecto) ? (
                <p className="whitespace-pre-line text-sm text-texto-suave">{texto(h.descripcion, idioma, defecto)}</p>
              ) : null}
              <p className="text-sm">
                {t('resumen', { asignadas: h.asignadas, cupo: h.cupo, solicitadas: h.solicitadas })}
                {h.precio !== null ? ` · ${formatearMonto(h.precio, evento.moneda, idioma)}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Insignia tono="info">{t(`criterios.${h.criterio}`)}</Insignia>
              {h.solicitadas > h.cupo ? <Insignia tono="alerta">{t('excedido')}</Insignia> : null}
            </div>
          </div>
          {h.solicitudes.length === 0 ? (
            <p className="text-sm text-texto-suave">{t('sinSolicitudes')}</p>
          ) : (
            <Tabla>
              <caption className="sr-only">{t('solicitudesDe', { hotel: h.nombre })}</caption>
              <thead>
                <tr>
                  <Th className="w-16 text-right">{t('prioridad')}</Th>
                  <Th>{t('academia')}</Th>
                  <Th className="text-right">{t('plazas')}</Th>
                  <Th className="text-right">{t('asignadas')}</Th>
                  <Th className="text-right">{t('enEspera')}</Th>
                  <Th>{t('inscripta')}</Th>
                  <Th>{t('primerPago')}</Th>
                </tr>
              </thead>
              <tbody>
                {h.solicitudes.map((s) => (
                  <tr key={s.id}>
                    <Td className="text-right font-mono tabular-nums">{s.asignacion?.prioridad}</Td>
                    <Td className="font-medium">{s.academia}</Td>
                    <Td className="text-right tabular-nums">{s.plazas}</Td>
                    <Td className="text-right tabular-nums">{s.asignacion?.plazasAsignadas ?? 0}</Td>
                    <Td className="text-right tabular-nums">
                      {s.asignacion?.enEspera ? <Insignia tono="alerta">{s.asignacion.enEspera}</Insignia> : '0'}
                    </Td>
                    <Td className="text-sm tabular-nums">{fecha(s.inscriptaAt)}</Td>
                    <Td className="text-sm tabular-nums">{fecha(s.primerPagoAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          )}
          {configura ? (
            <div className="flex flex-wrap items-start gap-3 border-t border-borde pt-3">
              <details className="flex-1">
                <summary className="cursor-pointer text-sm font-medium">{t('editar')}</summary>
                <FormularioHotel eventoId={eventoId} hotel={h} moneda={evento.moneda} />
              </details>
              {h.solicitudes.length === 0 ? (
                <FormularioAccion
                  accion={eliminarHotelAccion}
                  namespace="gestion.hoteles"
                  boton={t('eliminar')}
                  variante="fantasma"
                  tamano="chico"
                  enLinea
                >
                  <input type="hidden" name="hotelId" value={h.id} />
                </FormularioAccion>
              ) : null}
            </div>
          ) : null}
        </Tarjeta>
      ))}
      {configura ? (
        <details className="rounded-[var(--radio)] border border-dashed border-borde p-4" open={hoteles.length === 0}>
          <summary className="cursor-pointer font-medium">{t('nuevo')}</summary>
          <FormularioHotel eventoId={eventoId} moneda={evento.moneda} />
        </details>
      ) : null}
    </div>
  );
}
