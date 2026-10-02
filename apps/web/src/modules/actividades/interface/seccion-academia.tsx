import type { Idioma } from '@soed/domain';
import { CampoTexto, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { texto } from '@/lib/i18n/traducible';
import type { clasesParaAcademia } from '../infrastructure/consultas';
import { reservarClaseAcademiaAccion } from './acciones';

/** Reserva de clases para los bailarines de la academia (PR-31). El pago se registra en el evento. */
export async function SeccionClases({
  clases,
  eventoId,
  zona,
  idioma,
  defecto,
}: {
  clases: Awaited<ReturnType<typeof clasesParaAcademia>>;
  eventoId: string;
  zona: string;
  idioma: Idioma;
  defecto: Idioma;
}) {
  if (clases.length === 0) return null;
  const t = await getTranslations('academia.inscripcion.clases');
  const tv = await getTranslations('eventos');
  return (
    <section className="flex flex-col gap-3" aria-labelledby="clases">
      <h2 id="clases" className="font-display text-xl font-bold">
        {t('titulo')}
      </h2>
      <ul className="grid gap-3 md:grid-cols-2">
        {clases.map((c) => (
          <li key={c.id}>
            <Tarjeta className="flex h-full flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-display text-lg font-bold">{texto(c.nombre, idioma, defecto)}</p>
                  <p className="text-sm text-texto-suave">
                    {formatearInstante(c.inicio, idioma, zona)}
                    {c.docente ? ` · ${c.docente}` : ''} · {c.precio > 0 ? formatearMonto(c.precio, c.moneda, idioma) : tv('gratis')}
                  </p>
                </div>
                <Insignia tono={c.disponibles > 0 ? 'exito' : 'neutro'}>
                  {c.disponibles > 0 ? tv('disponibles', { cantidad: c.disponibles }) : tv('agotada')}
                </Insignia>
              </div>
              {c.reservas.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {c.reservas.map((r) => (
                    <li key={r.id} className="flex justify-between gap-2 rounded-md bg-superficie-2 px-3 py-1.5">
                      <span>{r.nombre}</span>
                      <span className="text-texto-suave">{r.pagada ? t('pagada') : t('pendientePago')}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {c.disponibles > 0 ? (
                <FormularioAccion
                  accion={reservarClaseAcademiaAccion}
                  namespace="academia.inscripcion.clases"
                  boton={t('reservar')}
                  tamano="chico"
                  variante="secundario"
                  enLinea
                  className="mt-auto"
                >
                  <input type="hidden" name="claseId" value={c.id} />
                  <input type="hidden" name="eventoId" value={eventoId} />
                  <CampoTexto name="nombre" etiqueta={t('bailarin')} maxLength={200} />
                </FormularioAccion>
              ) : null}
            </Tarjeta>
          </li>
        ))}
      </ul>
    </section>
  );
}
