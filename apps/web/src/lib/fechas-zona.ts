/**
 * Conversión entre la hora local de la sede (inputs datetime-local) y el
 * instante UTC que se guarda. La zona es la del evento, no la del navegador.
 */

function desfaseMinutos(instante: number, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instante));
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const comoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour'), v('minute'), v('second'));
  return Math.round((comoUtc - instante) / 60000);
}

const FORMATO_LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** '2026-11-01T10:00' en America/Sao_Paulo → '2026-11-01T13:00:00.000Z'. Null si el texto no es válido. */
export function instanteDesdeLocal(local: string, zona: string): string | null {
  const m = FORMATO_LOCAL.exec(local.trim());
  if (!m) return null;
  const [, a, mes, d, h, min] = m.map(Number) as [number, number, number, number, number, number];
  const ingenuo = Date.UTC(a, mes - 1, d, h, min);
  if (Number.isNaN(ingenuo)) return null;
  // Dos pasadas para cubrir cambios de horario de verano.
  let instante = ingenuo - desfaseMinutos(ingenuo, zona) * 60000;
  instante = ingenuo - desfaseMinutos(instante, zona) * 60000;
  return new Date(instante).toISOString();
}

/** Instante → 'YYYY-MM-DDTHH:mm' en la zona de la sede (valor de un input datetime-local). */
export function localDesdeInstante(instante: string | null | undefined, zona: string): string {
  if (!instante) return '';
  const t = Date.parse(instante);
  if (Number.isNaN(t)) return '';
  return new Date(t + desfaseMinutos(t, zona) * 60000).toISOString().slice(0, 16);
}
