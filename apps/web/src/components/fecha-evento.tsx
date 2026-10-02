import type { Idioma } from '@soed/domain';

/** Bloque de fecha destacado (día y mes) para listados de eventos. */
export function FechaEvento({ fecha, idioma }: { fecha: string; idioma: Idioma }) {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = new Intl.DateTimeFormat(idioma, { day: '2-digit', timeZone: 'UTC' }).format(d);
  const mes = new Intl.DateTimeFormat(idioma, { month: 'short', timeZone: 'UTC' }).format(d).replace('.', '');
  return (
    <div className="flex w-16 shrink-0 flex-col items-center rounded-[var(--radio)] bg-marca py-2 text-marca-contraste" aria-hidden>
      <span className="font-display text-2xl font-bold leading-none tabular-nums">{dia}</span>
      <span className="text-xs font-semibold">{mes}</span>
    </div>
  );
}
