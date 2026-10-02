import {
  err,
  errorDominio,
  ok,
  validarReglamento,
  type ErrorDominio,
  type Moneda,
  type ReglamentoEvento,
  type Result,
  type Traducible,
} from '@soed/domain';

export interface NuevoEvento {
  temporadaId: string;
  slug: string;
  tipo: 'SELECTIVO' | 'FINAL' | 'UNICO';
  nombre: Traducible;
  moneda: Moneda;
  idiomaDefecto: string;
  zonaHoraria: string;
  fechaInicio: string;
  fechaFin: string;
  sede: Record<string, string | undefined>;
  clonarDeEventoId?: string;
}

/** Configuración copiable de un evento anterior (SA-03). Nunca copia inscripciones ni datos operativos. */
export interface ConfiguracionClonable {
  reglamento: ReglamentoEvento;
  tarifario: Record<string, unknown>;
  mediosCobro: string[];
  datosPago: Traducible;
  bases: Traducible;
  configOperacion: Record<string, unknown>;
  criterios: { codigo: string; nombre: Traducible; peso: number; orden: number }[];
  pistas: { nombre: Traducible; orden: number }[];
}

export interface PuertosEventos {
  esSuperAdmin(): boolean;
  reglamentoDeTemporada(temporadaId: string): Promise<ReglamentoEvento | null>;
  configuracionDe(eventoId: string): Promise<ConfiguracionClonable | null>;
  slugDisponible(slug: string): Promise<boolean>;
  insertarEvento(evento: NuevoEvento, configuracion: ConfiguracionClonable): Promise<string>;
}

export type CodigoErrorEvento = 'SIN_PERMISO' | 'SLUG_EN_USO' | 'SIN_REGLAMENTO' | 'REGLAMENTO_INVALIDO' | 'EVENTO_ORIGEN_INEXISTENTE';

/**
 * Crea un evento con el reglamento de la temporada (snapshot, ADR-0006) o
 * clonando la configuración de otro evento (SA-02, SA-03). La moneda del
 * tarifario clonado se alinea con la del nuevo evento.
 */
export async function crearEvento(p: PuertosEventos, e: NuevoEvento): Promise<Result<{ eventoId: string }, ErrorDominio<CodigoErrorEvento>>> {
  if (!p.esSuperAdmin()) return err(errorDominio('SIN_PERMISO'));
  if (!(await p.slugDisponible(e.slug))) return err(errorDominio('SLUG_EN_USO', { slug: e.slug }));

  let config: ConfiguracionClonable;
  if (e.clonarDeEventoId) {
    const origen = await p.configuracionDe(e.clonarDeEventoId);
    if (!origen) return err(errorDominio('EVENTO_ORIGEN_INEXISTENTE'));
    config = { ...origen, tarifario: Object.keys(origen.tarifario).length > 0 ? { ...origen.tarifario, moneda: e.moneda } : {} };
  } else {
    const reglamento = await p.reglamentoDeTemporada(e.temporadaId);
    if (!reglamento) return err(errorDominio('SIN_REGLAMENTO'));
    config = {
      reglamento,
      tarifario: {},
      mediosCobro: ['EFECTIVO', 'MERCADO_PAGO', 'TRANSFERENCIA', 'PIX', 'OTRO'],
      datosPago: {},
      bases: {},
      configOperacion: { intervaloSegundos: 60, duracionPorDefectoSegundos: 240, juradosPorFicha: 3 },
      criterios: [],
      pistas: [{ nombre: { es: 'Pista principal', 'pt-BR': 'Palco principal' }, orden: 1 }],
    };
  }
  const errores = validarReglamento(config.reglamento);
  if (errores.length > 0) return err(errorDominio('REGLAMENTO_INVALIDO', { errores: errores.map((x) => x.codigo).join(',') }));
  const eventoId = await p.insertarEvento(e, config);
  return ok({ eventoId });
}
