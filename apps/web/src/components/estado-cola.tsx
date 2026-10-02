'use client';

import { Aviso, Boton } from '@soed/ui';
import { useTranslations } from 'next-intl';
import { libre } from '@/lib/i18n/claves';
import { descartar } from '@/lib/offline/outbox';
import { useOutbox } from '@/lib/offline/use-outbox';

/** Conexión y operaciones pendientes o rechazadas de la cola offline (ADR-0010). */
export function EstadoCola({ usuarioId }: { usuarioId: string }) {
  const t = useTranslations('offline');
  const te = libre(useTranslations('errores'));
  const { enLinea, pendientes, rechazadas, sincronizar } = useOutbox(usuarioId);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm" role="status">
        <span className="inline-flex items-center gap-2 font-medium">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${enLinea ? 'bg-exito' : 'bg-error'}`} />
          {enLinea ? t('enLinea') : t('sinConexion')}
        </span>
        {pendientes.length > 0 ? <span>{t('pendientes', { cantidad: pendientes.length })}</span> : null}
        {pendientes.length > 0 && enLinea ? (
          <Boton tamano="chico" variante="secundario" onClick={() => void sincronizar()}>
            {t('reintentar')}
          </Boton>
        ) : null}
      </div>
      {rechazadas.map((op) => (
        <Aviso key={op.id} tono="error" titulo={t('rechazada', { etiqueta: op.etiqueta ?? op.tipo })}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{op.codigo && te.has(op.codigo) ? te(op.codigo) : te('INESPERADO')}</span>
            <Boton tamano="chico" variante="fantasma" onClick={() => void descartar(op.id)}>
              {t('descartar')}
            </Boton>
          </div>
        </Aviso>
      ))}
    </div>
  );
}
