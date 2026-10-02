/**
 * Fechas de calendario sin hora (YYYY-MM-DD). Evitan errores de zona horaria al
 * calcular edades: la edad se compara contra la fecha de referencia del evento,
 * no contra un instante.
 */
export type FechaISO = string & { readonly __brand: 'FechaISO' };

const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PartesFecha {
  readonly anio: number;
  readonly mes: number;
  readonly dia: number;
}

function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function partesFecha(valor: string): PartesFecha | null {
  const m = PATRON.exec(valor);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasDelMes(anio, mes)) return null;
  return { anio, mes, dia };
}

export function esFechaISO(valor: string): valor is FechaISO {
  return partesFecha(valor) !== null;
}

/** Convierte un string validado a FechaISO o lanza (solo para datos de confianza: presets y tests). */
export function fechaISO(valor: string): FechaISO {
  if (!esFechaISO(valor)) throw new Error(`Fecha inválida: ${valor}`);
  return valor;
}

/**
 * Edad en años cumplidos a la fecha de referencia. Quien nació un 29/02 cumple
 * años el 01/03 en años no bisiestos (se compara mes y día).
 */
export function edadCumplida(nacimiento: FechaISO, referencia: FechaISO): number {
  const n = partesFecha(nacimiento);
  const r = partesFecha(referencia);
  if (!n || !r) throw new Error('Fechas inválidas');
  let edad = r.anio - n.anio;
  if (r.mes < n.mes || (r.mes === n.mes && r.dia < n.dia)) edad -= 1;
  return edad;
}

export function compararFechas(a: FechaISO, b: FechaISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Fecha de calendario de un instante en una zona horaria IANA (por ejemplo, America/Sao_Paulo). */
export function fechaEnZona(instante: Date, zonaHoraria: string): FechaISO {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
  return fechaISO(partes);
}
