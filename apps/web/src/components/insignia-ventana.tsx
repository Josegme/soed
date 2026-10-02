import type { EstadoVentana } from '@soed/domain';
import { Insignia } from '@soed/ui';
import { getTranslations } from 'next-intl/server';

const TONO: Record<EstadoVentana, 'exito' | 'alerta' | 'neutro' | 'info'> = {
  ABIERTA: 'exito',
  SOLO_MODIFICACIONES: 'alerta',
  NO_ABIERTA: 'info',
  CERRADA: 'neutro',
};

export async function InsigniaVentana({ ventana }: { ventana: EstadoVentana }) {
  const t = await getTranslations('eventos.ventana');
  return <Insignia tono={TONO[ventana]}>{t(ventana)}</Insignia>;
}
