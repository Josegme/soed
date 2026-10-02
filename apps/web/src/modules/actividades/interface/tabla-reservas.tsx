import type { Idioma } from '@soed/domain';
import { Insignia, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearInstante } from '@/lib/i18n/formato';
import type { Reserva } from '../infrastructure/consultas';
import { cancelarReservaAccion, cobrarReservaAccion } from './acciones';

/** Reservas de una clase o entrada con cobro manual y cancelación (OR-53). */
export async function TablaReservas({
  tipo,
  reservas,
  titulo,
  idioma,
  zona,
  puedeCobrar,
}: {
  tipo: 'clase' | 'entrada';
  reservas: readonly Reserva[];
  titulo: string;
  idioma: Idioma;
  zona: string;
  puedeCobrar: boolean;
}) {
  const t = await getTranslations('gestion.actividades');
  if (reservas.length === 0) return <p className="text-sm text-texto-suave">{t('sinReservas')}</p>;
  return (
    <Tabla>
      <caption className="sr-only">{t('reservasDe', { titulo })}</caption>
      <thead>
        <tr>
          <Th>{t('persona')}</Th>
          {tipo === 'entrada' ? <Th className="text-right">{t('cantidad')}</Th> : null}
          <Th>{t('fechaReserva')}</Th>
          <Th>{t('estado')}</Th>
          {puedeCobrar ? <Th>{t('acciones')}</Th> : null}
        </tr>
      </thead>
      <tbody>
        {reservas.map((r) => (
          <tr key={r.id}>
            <Td>
              <span className="font-medium">{r.nombre}</span>
              <span className="block text-xs text-texto-suave">{[r.academia, r.email, r.codigo].filter(Boolean).join(' · ')}</span>
            </Td>
            {tipo === 'entrada' ? <Td className="text-right tabular-nums">{r.cantidad}</Td> : null}
            <Td className="text-sm tabular-nums">
              {formatearInstante(r.creadoAt, idioma, zona, { dateStyle: 'short', timeStyle: 'short' })}
            </Td>
            <Td>
              {r.estado === 'CANCELADA' ? (
                <Insignia tono="neutro">{t('estados.CANCELADA')}</Insignia>
              ) : r.pagada ? (
                <Insignia tono="exito">{t('pagada')}</Insignia>
              ) : (
                <Insignia tono="alerta">{t('pendientePago')}</Insignia>
              )}
            </Td>
            {puedeCobrar ? (
              <Td>
                {r.estado !== 'CANCELADA' ? (
                  <div className="flex flex-wrap gap-2">
                    {!r.pagada ? (
                      <FormularioAccion
                        accion={cobrarReservaAccion}
                        namespace="gestion.actividades"
                        boton={t('cobrar')}
                        tamano="chico"
                        enLinea
                      >
                        <input type="hidden" name="tipo" value={tipo} />
                        <input type="hidden" name="reservaId" value={r.id} />
                      </FormularioAccion>
                    ) : null}
                    <FormularioAccion
                      accion={cancelarReservaAccion}
                      namespace="gestion.actividades"
                      boton={t('cancelar')}
                      variante="fantasma"
                      tamano="chico"
                      enLinea
                    >
                      <input type="hidden" name="tipo" value={tipo} />
                      <input type="hidden" name="reservaId" value={r.id} />
                    </FormularioAccion>
                  </div>
                ) : null}
              </Td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </Tabla>
  );
}
