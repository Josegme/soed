/**
 * Contenido de los emails transaccionales (PR-22, TR-22). Puro: recibe el
 * traductor del idioma del destinatario, así que el mismo evento genera un
 * email en español y otro en portugués sin lógica duplicada.
 */
export const TIPOS_NOTIFICACION = [
  'inscripcion_confirmada',
  'liquidacion_emitida',
  'cobro_registrado',
  'ficha_observada',
  'orden_publicado',
  'resultados_publicados',
  'invitacion_academia',
  'recordatorio_cierre',
  'reserva_recibida',
] as const;
export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export type Traductor = (clave: string, valores?: Record<string, string | number>) => string;

export interface ContenidoEmail {
  asunto: string;
  titulo: string;
  parrafos: string[];
  detalle?: { etiqueta: string; valor: string }[];
  accion?: { texto: string; url: string };
  nota: string;
  pie: string;
}

/** Datos que se muestran como tabla de detalle en cada tipo (el resto solo se interpola). */
const DETALLE: Partial<Record<TipoNotificacion, readonly string[]>> = {
  liquidacion_emitida: ['numero', 'total'],
  cobro_registrado: ['numero', 'monto', 'saldo'],
  ficha_observada: ['ficha'],
  recordatorio_cierre: ['cierre', 'pendientes'],
  reserva_recibida: ['codigo', 'detalle', 'cantidad', 'total'],
};

export function contenidoEmail(tipo: TipoNotificacion, datos: Record<string, string>, t: Traductor, url: string): ContenidoEmail {
  const detalle = (DETALLE[tipo] ?? [])
    .filter((campo) => datos[campo])
    .map((campo) => ({ etiqueta: t(`detalle.${campo}`), valor: datos[campo]! }));
  return {
    asunto: t(`${tipo}.asunto`, datos),
    titulo: t(`${tipo}.titulo`, datos),
    parrafos: [t(`${tipo}.cuerpo`, datos)],
    detalle: detalle.length > 0 ? detalle : undefined,
    accion: { texto: t(`${tipo}.accion`), url },
    nota: t('nota'),
    pie: t('pie', datos),
  };
}
