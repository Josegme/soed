import type { Idioma, Moneda } from '@soed/domain';

/** Monto en la moneda del evento con el formato del idioma (TR-17, TR-23). */
export function formatearMonto(centavos: number, moneda: Moneda | string, idioma: Idioma): string {
  return new Intl.NumberFormat(idioma, { style: 'currency', currency: moneda }).format(centavos / 100);
}

/** Fecha (YYYY-MM-DD) sin conversión de zona: es una fecha de calendario. */
export function formatearFecha(fechaISO: string, idioma: Idioma, opciones: Intl.DateTimeFormatOptions = { dateStyle: 'long' }): string {
  const [a, m, d] = fechaISO.split('-').map(Number);
  return new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: 'UTC' }).format(new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)));
}

/** Instante en la zona horaria de la sede. */
export function formatearInstante(
  instante: string | Date,
  idioma: Idioma,
  zonaHoraria: string,
  opciones: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat(idioma, { ...opciones, timeZone: zonaHoraria }).format(new Date(instante));
}

export function formatearRangoFechas(inicio: string, fin: string, idioma: Idioma): string {
  if (inicio === fin) return formatearFecha(inicio, idioma);
  const a = new Date(`${inicio}T00:00:00Z`);
  const b = new Date(`${fin}T00:00:00Z`);
  return new Intl.DateTimeFormat(idioma, { dateStyle: 'long', timeZone: 'UTC' }).formatRange(a, b);
}

export function formatearDuracion(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatearPuntaje(valor: number, idioma: Idioma, decimales = 2, conSigno = false): string {
  return new Intl.NumberFormat(idioma, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    signDisplay: conSigno ? 'exceptZero' : 'auto',
  }).format(valor);
}
