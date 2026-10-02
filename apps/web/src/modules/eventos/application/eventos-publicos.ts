import { estadoVentana, type EstadoVentana, type ReglamentoEvento, type Traducible } from '@soed/domain';

/** Proyección pública de un evento: sin tarifario ni datos de pago. */
export interface EventoPublico {
  id: string;
  slug: string;
  tipo: 'SELECTIVO' | 'FINAL' | 'UNICO';
  nombre: Traducible;
  idiomaDefecto: string;
  moneda: string;
  zonaHoraria: string;
  sede: { venue?: string; ciudad?: string; region?: string; pais?: string; direccion?: string };
  fechaInicio: string;
  fechaFin: string;
  inscripcionApertura: string | null;
  inscripcionCierre: string | null;
  modificacionesCierre: string | null;
  bases: Traducible;
  /** Reglamento público del evento (bases): nombres de categorías, géneros y formaciones. */
  reglamento: ReglamentoEvento;
  ordenPublicado: boolean;
  resultadosPublicados: boolean;
}

export interface EventoPublicoConVentana extends EventoPublico {
  ventana: EstadoVentana;
}

export interface FilaOrdenPublica {
  pista: Traducible;
  bloque: Traducible;
  inicioProgramado: string | null;
  posicion: number;
  estado: string;
  coreografia: string;
  academia: string;
  ciudad: string | null;
  categoria: string | null;
  formacion: string;
  genero: string;
}

export interface FilaResultadoPublico {
  grupo: string;
  puesto: number;
  puntaje: number;
  banda: string | null;
  coreografia: string;
  academia: string;
  ciudad: string | null;
  categoria: string | null;
  formacion: string;
  genero: string;
}

/** Bloque del cronograma público (PU-06): sin coreografías. */
export interface FilaCronogramaPublico {
  pista: Traducible;
  bloque: Traducible;
  inicio: string;
}

/** Clase publicada con su disponibilidad (PU-09). */
export interface ClasePublica {
  id: string;
  nombre: Traducible;
  docente: string | null;
  sala: string | null;
  inicio: string;
  fin: string;
  precio: number;
  moneda: string;
  disponibles: number;
}

/** Tipo de entrada publicado con su disponibilidad (PU-10). */
export interface EntradaPublica {
  id: string;
  nombre: Traducible;
  fecha: string | null;
  precio: number;
  moneda: string;
  disponibles: number;
}

/** Puerto de lectura pública. La implementación usa el rol anon (RLS + grants de columnas). */
export interface RepositorioEventosPublicos {
  listarPublicados(): Promise<EventoPublico[]>;
  buscarPorSlug(slug: string): Promise<EventoPublico | null>;
  ordenPublico(slug: string): Promise<FilaOrdenPublica[]>;
  resultadosPublicos(slug: string): Promise<FilaResultadoPublico[]>;
  cronogramaPublico(slug: string): Promise<FilaCronogramaPublico[]>;
  clasesPublicas(slug: string): Promise<ClasePublica[]>;
  entradasPublicas(slug: string): Promise<EntradaPublica[]>;
}

const conVentana = (e: EventoPublico, ahora: Date): EventoPublicoConVentana => ({
  ...e,
  ventana: estadoVentana(
    { apertura: e.inscripcionApertura, cierre: e.inscripcionCierre, cierreModificaciones: e.modificacionesCierre },
    ahora,
  ),
});

/** Eventos publicados, próximos primero y luego los pasados (PU-03). */
export async function listarEventosPublicos(repo: RepositorioEventosPublicos, ahora: Date): Promise<EventoPublicoConVentana[]> {
  const hoy = ahora.toISOString().slice(0, 10);
  const eventos = (await repo.listarPublicados()).map((e) => conVentana(e, ahora));
  const proximos = eventos.filter((e) => e.fechaFin >= hoy).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  const pasados = eventos.filter((e) => e.fechaFin < hoy).sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio));
  return [...proximos, ...pasados];
}

export async function obtenerEventoPublico(
  repo: RepositorioEventosPublicos,
  slug: string,
  ahora: Date,
): Promise<EventoPublicoConVentana | null> {
  if (!/^[A-Za-z0-9]{2,16}$/.test(slug)) return null;
  const evento = await repo.buscarPorSlug(slug.toUpperCase());
  return evento ? conVentana(evento, ahora) : null;
}

export interface GrupoOrden {
  clave: string;
  pista: Traducible;
  bloque: Traducible;
  inicioProgramado: string | null;
  filas: FilaOrdenPublica[];
}

/** Agrupa el orden público por pista y bloque, conservando el orden recibido (PU-07). */
export function agruparOrden(filas: readonly FilaOrdenPublica[]): GrupoOrden[] {
  const grupos = new Map<string, GrupoOrden>();
  for (const f of filas) {
    const clave = `${JSON.stringify(f.pista)}|${JSON.stringify(f.bloque)}`;
    const g = grupos.get(clave) ?? { clave, pista: f.pista, bloque: f.bloque, inicioProgramado: f.inicioProgramado, filas: [] };
    g.filas.push(f);
    grupos.set(clave, g);
  }
  return [...grupos.values()];
}

export interface DiaCronograma {
  /** Fecha local de la sede (YYYY-MM-DD). */
  dia: string;
  bloques: FilaCronogramaPublico[];
}

/** Agrupa el cronograma por día en la zona horaria de la sede (PU-06). */
export function agruparCronogramaPorDia(filas: readonly FilaCronogramaPublico[], zonaHoraria: string): DiaCronograma[] {
  const fecha = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dias = new Map<string, FilaCronogramaPublico[]>();
  for (const f of [...filas].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const dia = fecha.format(new Date(f.inicio));
    dias.set(dia, [...(dias.get(dia) ?? []), f]);
  }
  return [...dias.entries()].map(([dia, bloques]) => ({ dia, bloques }));
}
