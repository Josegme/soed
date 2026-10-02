'use client';

import { useEffect } from 'react';

/** Registra el service worker de la PWA (PU-14) cuando la instancia tiene el módulo activo. */
export function RegistroServiceWorker({ activo }: { activo: boolean }) {
  useEffect(() => {
    if (!activo || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, [activo]);
  return null;
}
