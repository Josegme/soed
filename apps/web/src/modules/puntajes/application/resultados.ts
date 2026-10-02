import {
  banda,
  claveGrupo,
  detectarDesvios,
  err,
  errorDominio,
  ok,
  puntajeFinal,
  ranking,
  type Desvio,
  type ErrorDominio,
  type ReglamentoEvento,
  type Result,
  type ResultadoFicha,
} from '@soed/domain';

export interface PlanillaParaResultado {
  fichaId: string;
  juradoId: string;
  total: number | null;
  estado: 'BORRADOR' | 'ENVIADA' | 'REABIERTA';
}

export interface FichaParaResultado {
  id: string;
  academiaId: string;
  categoria: string | null;
  formacion: string;
  genero: string;
}

export interface ResultadoCalculado {
  fichaId: string;
  academiaId: string;
  puntaje: number;
  banda: string | null;
  grupo: string;
  puesto: number;
}

export interface PuertosResultados {
  puedeSupervisar(eventoId: string): boolean;
  reglamento(eventoId: string): Promise<ReglamentoEvento | null>;
  fichasPresentadas(eventoId: string): Promise<FichaParaResultado[]>;
  planillas(eventoId: string): Promise<PlanillaParaResultado[]>;
  /** Reemplaza los resultados del evento (servidor; la academia no los escribe). */
  guardarResultados(eventoId: string, resultados: ResultadoCalculado[]): Promise<void>;
}

export type CodigoErrorResultados = 'SIN_PERMISO' | 'EVENTO_INEXISTENTE' | 'SIN_PLANILLAS';

export interface CalculoResultados {
  resultados: ResultadoCalculado[];
  /** Fichas sin todas las planillas enviadas: quedan fuera hasta completarse. */
  pendientes: string[];
  desvios: { fichaId: string; desvios: Desvio[] }[];
}

/**
 * Calcula puntaje final, banda y puesto por grupo (OR-41, TR-08) con las
 * planillas enviadas. No decide pases ni premios (TR-13): solo informa.
 */
export async function calcularResultados(
  p: PuertosResultados,
  eventoId: string,
  opciones: { juradosEsperados: number },
): Promise<Result<CalculoResultados, ErrorDominio<CodigoErrorResultados>>> {
  if (!p.puedeSupervisar(eventoId)) return err(errorDominio('SIN_PERMISO'));
  const reglamento = await p.reglamento(eventoId);
  if (!reglamento) return err(errorDominio('EVENTO_INEXISTENTE'));
  const [fichas, planillas] = await Promise.all([p.fichasPresentadas(eventoId), p.planillas(eventoId)]);
  if (planillas.length === 0) return err(errorDominio('SIN_PLANILLAS'));

  const porFicha = new Map<string, PlanillaParaResultado[]>();
  for (const pl of planillas) porFicha.set(pl.fichaId, [...(porFicha.get(pl.fichaId) ?? []), pl]);

  const completas: ResultadoFicha[] = [];
  const pendientes: string[] = [];
  const desvios: CalculoResultados['desvios'] = [];
  for (const f of fichas) {
    const enviadas = (porFicha.get(f.id) ?? []).filter((pl) => pl.estado === 'ENVIADA' && pl.total !== null);
    if (enviadas.length < opciones.juradosEsperados || !f.categoria) {
      pendientes.push(f.id);
      continue;
    }
    const puntaje = puntajeFinal(enviadas.map((pl) => Number(pl.total)), reglamento.puntaje);
    if (puntaje === null) continue;
    completas.push({ fichaId: f.id, categoria: f.categoria, formacion: f.formacion, genero: f.genero, puntaje });
    const d = detectarDesvios(enviadas.map((pl) => ({ juradoId: pl.juradoId, total: Number(pl.total) })), reglamento.puntaje.umbralDesvio);
    if (d.length > 0) desvios.push({ fichaId: f.id, desvios: d });
  }

  const puestos = ranking(completas, reglamento.puntaje.agrupacionRanking);
  const resultados: ResultadoCalculado[] = completas.map((r) => {
    const puesto = puestos.find((x) => x.fichaId === r.fichaId);
    return {
      fichaId: r.fichaId,
      academiaId: fichas.find((f) => f.id === r.fichaId)?.academiaId ?? '',
      puntaje: r.puntaje,
      banda: banda(r.puntaje, reglamento.bandas)?.codigo ?? null,
      grupo: claveGrupo(r, reglamento.puntaje.agrupacionRanking),
      puesto: puesto?.puesto ?? 0,
    };
  });
  await p.guardarResultados(eventoId, resultados);
  return ok({ resultados, pendientes, desvios });
}
