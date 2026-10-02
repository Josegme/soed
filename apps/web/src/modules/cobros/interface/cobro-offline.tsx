'use client';

import { Aviso, Boton, CampoSelector, CampoTexto } from '@soed/ui';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { libre } from '@/lib/i18n/claves';
import { parsearMonto } from '@/lib/formularios';
import { encolar, sincronizar } from '@/lib/offline/outbox';

/**
 * Cobro en la mesa de caja con cola offline (OP-20, ADR-0010): si se corta la
 * conexión de la sede queda en el dispositivo y se envía después, sin duplicar.
 */
export function CobroOffline({
  usuarioId,
  liquidacionId,
  numero,
  moneda,
  medios,
  montoSugerido,
}: {
  usuarioId: string;
  liquidacionId: string;
  numero: string;
  moneda: string;
  medios: readonly { valor: string; etiqueta: string }[];
  montoSugerido: string;
}) {
  const t = useTranslations('gestion.cobros');
  const te = libre(useTranslations('errores'));
  const to = useTranslations('offline');
  const router = useRouter();
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error' | 'info'; texto: string } | null>(null);
  const [pendiente, iniciar] = useTransition();

  return (
    <form
      className="mt-2 flex max-w-md flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const datos = new FormData(e.currentTarget);
        const monto = parsearMonto(String(datos.get('monto') ?? ''));
        if (!monto) {
          setAviso({ tono: 'error', texto: te('MONTO_INVALIDO') });
          return;
        }
        const formulario = e.currentTarget;
        iniciar(async () => {
          const clientUuid = crypto.randomUUID();
          await encolar({
            id: clientUuid,
            tipo: 'cobro',
            usuarioId,
            etiqueta: numero,
            datos: {
              liquidacionId,
              montoCentavos: monto,
              moneda,
              medio: String(datos.get('medio')),
              referencia: String(datos.get('referencia') ?? '').trim() || undefined,
              clientUuid,
              dispositivoAt: new Date().toISOString(),
            },
          });
          const r = (await sincronizar(usuarioId)).find((x) => x.id === clientUuid);
          if (!r) setAviso({ tono: 'info', texto: to('guardadoLocal') });
          else if (r.ok) {
            setAviso({ tono: 'exito', texto: t('cobroRegistrado') });
            formulario.reset();
            router.refresh();
          } else setAviso({ tono: 'error', texto: r.codigo && te.has(r.codigo) ? te(r.codigo) : te('INESPERADO') });
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto name="monto" etiqueta={t('monto', { moneda })} inputMode="decimal" defaultValue={montoSugerido} requerido />
        <CampoSelector name="medio" etiqueta={t('medio')} opciones={medios} />
      </div>
      <CampoTexto name="referencia" etiqueta={t('referencia')} maxLength={200} />
      <div>
        <Boton type="submit" tamano="chico" cargando={pendiente}>
          {t('confirmarCobro')}
        </Boton>
      </div>
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
    </form>
  );
}
