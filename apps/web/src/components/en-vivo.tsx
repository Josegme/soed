'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabaseNavegador } from '@/lib/supabase/navegador';

type TablaEnVivo = 'orden_item' | 'planilla';

/**
 * Refresca la vista ante cambios del evento (ADR-0012): Supabase Realtime con
 * la RLS del usuario y, si el canal no está suscripto (red de la sede, límite
 * de conexiones), sondeo periódico mientras la pestaña está visible.
 */
export function EnVivo({
  url,
  clave,
  eventoId,
  tablas,
  respaldoSegundos = 15,
}: {
  url: string | null;
  clave: string | null;
  eventoId: string;
  tablas: readonly TablaEnVivo[];
  respaldoSegundos?: number;
}) {
  const t = useTranslations('vivo');
  const router = useRouter();
  const [conectado, setConectado] = useState(false);
  const claveTablas = tablas.join(',');

  useEffect(() => {
    let suscripto = false;
    let espera: number | undefined;
    const refrescar = () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => router.refresh(), 250);
    };
    const db = url && clave ? supabaseNavegador(url, clave) : null;
    const canal = db?.channel(`vivo:${eventoId}:${claveTablas}`);
    if (db && canal) {
      for (const tabla of claveTablas.split(',')) {
        canal.on('postgres_changes', { event: '*', schema: 'public', table: tabla, filter: `evento_id=eq.${eventoId}` }, refrescar);
      }
      canal.subscribe((estado) => {
        suscripto = estado === 'SUBSCRIBED';
        setConectado(suscripto);
      });
    }
    const sondeo = window.setInterval(() => {
      if (!suscripto && document.visibilityState === 'visible') router.refresh();
    }, respaldoSegundos * 1000);
    return () => {
      window.clearInterval(sondeo);
      window.clearTimeout(espera);
      if (db && canal) void db.removeChannel(canal);
    };
  }, [url, clave, eventoId, claveTablas, respaldoSegundos, router]);

  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium text-texto-suave">
      <span aria-hidden="true" className={`size-2 rounded-full ${conectado ? 'bg-exito' : 'bg-alerta'}`} />
      {conectado ? t('conectado') : t('sondeo', { segundos: respaldoSegundos })}
    </span>
  );
}
