'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { EVENTO_OUTBOX, operaciones, sincronizar, type OperacionPendiente } from './outbox';

function suscribirConexion(cambio: () => void) {
  window.addEventListener('online', cambio);
  window.addEventListener('offline', cambio);
  return () => {
    window.removeEventListener('online', cambio);
    window.removeEventListener('offline', cambio);
  };
}

/** Estado de la cola offline del usuario y reintento automático al recuperar la conexión y cada 20 s. */
export function useOutbox(usuarioId: string) {
  const enLinea = useSyncExternalStore(
    suscribirConexion,
    () => navigator.onLine,
    () => true,
  );
  const [lista, setLista] = useState<OperacionPendiente[]>([]);
  const recargar = useCallback(() => {
    void operaciones(usuarioId).then(setLista);
  }, [usuarioId]);

  useEffect(() => {
    recargar();
    window.addEventListener(EVENTO_OUTBOX, recargar);
    const reintentar = () => void sincronizar(usuarioId);
    window.addEventListener('online', reintentar);
    const id = window.setInterval(() => navigator.onLine && reintentar(), 20_000);
    return () => {
      window.removeEventListener(EVENTO_OUTBOX, recargar);
      window.removeEventListener('online', reintentar);
      window.clearInterval(id);
    };
  }, [recargar, usuarioId]);

  return {
    enLinea,
    pendientes: lista.filter((o) => o.estado === 'PENDIENTE'),
    rechazadas: lista.filter((o) => o.estado === 'RECHAZADA'),
    sincronizar: () => sincronizar(usuarioId),
  };
}
