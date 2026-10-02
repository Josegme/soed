import { err, errorDominio, ok, totalPlanilla, validarNota, type ConfigPuntaje, type ErrorDominio, type Result } from '@soed/domain';

export interface CriterioDeEvento {
  id: string;
  codigo: string;
  peso: number;
}

export interface PlanillaPropia {
  id: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'REABIERTA';
}

export interface PuertosPlanilla {
  puedeCargar(eventoId: string): boolean;
  ficha(fichaId: string): Promise<{ id: string; eventoId: string; academiaId: string } | null>;
  configuracion(eventoId: string): Promise<{ criterios: CriterioDeEvento[]; puntaje: ConfigPuntaje } | null>;
  /** Planilla ya procesada con este client_uuid (reintento de la cola offline). */
  planillaPorClientUuid(clientUuid: string): Promise<PlanillaPropia | null>;
  planillaPropia(fichaId: string): Promise<PlanillaPropia | null>;
  crear(d: { eventoId: string; academiaId: string; fichaId: string; clientUuid: string; comentario: string | null }): Promise<string>;
  guardarNotas(planillaId: string, eventoId: string, notas: { criterioId: string; valor: number }[]): Promise<void>;
  actualizar(planillaId: string, cambios: { comentario: string | null; clientUuid: string; enviar: boolean }): Promise<void>;
}

export type CodigoErrorPlanilla =
  | 'SIN_PERMISO'
  | 'FICHA_INEXISTENTE'
  | 'SIN_CRITERIOS'
  | 'PLANILLA_ENVIADA'
  | 'NOTA_FUERA_DE_ESCALA'
  | 'DECIMALES_EXCEDIDOS'
  | 'CRITERIO_FALTANTE'
  | 'CRITERIO_DESCONOCIDO';

export interface EntradaPlanilla {
  fichaId: string;
  notas: { criterioId: string; valor: number }[];
  comentario?: string | null;
  enviar: boolean;
  clientUuid: string;
}

/**
 * Guarda (y opcionalmente envía) la planilla del jurado (JU-03 a JU-06). Es
 * idempotente por client_uuid: la cola offline puede reintentar sin duplicar
 * ni fallar (ADR-0010). Las notas se validan contra la escala del reglamento
 * del evento; la base vuelve a validarlas y recalcula el total.
 */
export async function guardarPlanilla(
  p: PuertosPlanilla,
  e: EntradaPlanilla,
): Promise<Result<{ planillaId: string; enviada: boolean; total: number | null; duplicado: boolean }, ErrorDominio<CodigoErrorPlanilla>>> {
  const ficha = await p.ficha(e.fichaId);
  if (!ficha) return err(errorDominio('FICHA_INEXISTENTE'));
  if (!p.puedeCargar(ficha.eventoId)) return err(errorDominio('SIN_PERMISO'));

  const repetida = await p.planillaPorClientUuid(e.clientUuid);
  if (repetida) return ok({ planillaId: repetida.id, enviada: repetida.estado === 'ENVIADA', total: null, duplicado: true });

  const config = await p.configuracion(ficha.eventoId);
  if (!config || config.criterios.length === 0) return err(errorDominio('SIN_CRITERIOS'));
  const porId = new Map(config.criterios.map((c) => [c.id, c]));
  for (const n of e.notas) {
    if (!porId.has(n.criterioId)) return err(errorDominio('CRITERIO_DESCONOCIDO', { criterio: n.criterioId }));
    const v = validarNota(n.valor, config.puntaje);
    if (!v.ok) return err(v.error);
  }
  const total = totalPlanilla(
    e.notas.map((n) => ({ criterio: porId.get(n.criterioId)!.codigo, valor: n.valor })),
    config.criterios.map((c) => ({ codigo: c.codigo, peso: c.peso })),
    config.puntaje,
  );
  // Un borrador puede estar incompleto; enviar exige todas las notas.
  if (e.enviar && !total.ok) return err(total.error);

  const propia = await p.planillaPropia(ficha.id);
  if (propia?.estado === 'ENVIADA') return err(errorDominio('PLANILLA_ENVIADA'));
  const comentario = e.comentario?.trim() || null;
  const planillaId =
    propia?.id ??
    (await p.crear({ eventoId: ficha.eventoId, academiaId: ficha.academiaId, fichaId: ficha.id, clientUuid: e.clientUuid, comentario }));
  if (e.notas.length > 0) await p.guardarNotas(planillaId, ficha.eventoId, e.notas);
  await p.actualizar(planillaId, { comentario, clientUuid: e.clientUuid, enviar: e.enviar });
  return ok({ planillaId, enviada: e.enviar, total: total.ok ? total.value : null, duplicado: false });
}
