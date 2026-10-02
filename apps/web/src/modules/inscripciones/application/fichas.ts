import {
  err,
  errorDominio,
  estadoVentana,
  ok,
  validarFicha,
  type ErrorDominio,
  type FechaISO,
  type ReglamentoEvento,
  type Result,
  type ResultadoValidacion,
} from '@soed/domain';

/** Datos de la ficha leídos con el cliente del usuario (RLS decide si puede verla). */
export interface FichaParaValidar {
  id: string;
  eventoId: string;
  academiaId: string;
  estado: 'BORRADOR' | 'ENVIADA' | 'OBSERVADA' | 'APROBADA' | 'RETIRADA';
  bloqueada: boolean;
  genero: string;
  formacion: string;
  categoriaDeclarada: string | null;
  duracionMusicaSegundos: number | null;
  tieneExcepcion: boolean;
  integrantes: { bailarinId: string; fechaNacimiento: FechaISO }[];
}

export interface EventoParaValidar {
  id: string;
  reglamento: ReglamentoEvento;
  reglamentoVersion: number;
  fechaInicio: FechaISO;
  fechaFin: FechaISO;
  inscripcionApertura: string | null;
  inscripcionCierre: string | null;
  modificacionesCierre: string | null;
}

export interface PuertosFicha {
  leerFicha(fichaId: string): Promise<FichaParaValidar | null>;
  leerEvento(eventoId: string): Promise<EventoParaValidar | null>;
  /** ¿El usuario actual es miembro de la academia o gestiona inscripciones del evento? */
  puedeEditar(ficha: FichaParaValidar): Promise<{ academia: boolean; gestor: boolean }>;
  /**
   * Escritura de columnas derivadas (servidor, ADR-0006). `nuevoEstado` llega
   * cuando una ficha enviada deja de cumplir tras un cambio de reglamento.
   */
  guardarValidacion(
    fichaId: string,
    resultado: ResultadoValidacion,
    reglamentoVersion: number,
    nuevoEstado?: 'OBSERVADA',
  ): Promise<void>;
  marcarEnviada(fichaId: string): Promise<void>;
}

export type CodigoErrorFicha =
  | 'FICHA_INEXISTENTE'
  | 'EVENTO_INEXISTENTE'
  | 'SIN_PERMISO'
  | 'FICHA_NO_MODIFICABLE'
  | 'FICHA_INVALIDA'
  | 'FICHA_RETIRADA';

type Salida = Result<ResultadoValidacion, ErrorDominio<CodigoErrorFicha>>;

async function cargar(p: PuertosFicha, fichaId: string) {
  const ficha = await p.leerFicha(fichaId);
  if (!ficha) return err(errorDominio<CodigoErrorFicha>('FICHA_INEXISTENTE'));
  const evento = await p.leerEvento(ficha.eventoId);
  if (!evento) return err(errorDominio<CodigoErrorFicha>('EVENTO_INEXISTENTE'));
  const permisos = await p.puedeEditar(ficha);
  if (!permisos.academia && !permisos.gestor) return err(errorDominio<CodigoErrorFicha>('SIN_PERMISO'));
  return ok({ ficha, evento, permisos });
}

function ejecutarValidacion(ficha: FichaParaValidar, evento: EventoParaValidar): ResultadoValidacion {
  return validarFicha(
    evento.reglamento,
    { fechaInicio: evento.fechaInicio, fechaFin: evento.fechaFin },
    {
      formacion: ficha.formacion,
      genero: ficha.genero,
      categoriaDeclarada: ficha.categoriaDeclarada,
      integrantes: ficha.integrantes,
      duracionMusicaSegundos: ficha.duracionMusicaSegundos,
    },
  );
}

/**
 * Recalcula la validación de una ficha con el reglamento vigente del evento y
 * la guarda (PR-11, PR-12, TR-11). Lo puede pedir la academia o el organizador.
 */
export async function revalidarFicha(p: PuertosFicha, fichaId: string): Promise<Salida> {
  const carga = await cargar(p, fichaId);
  if (!carga.ok) return carga;
  const { ficha, evento } = carga.value;
  const resultado = ejecutarValidacion(ficha, evento);
  // Una ficha enviada que deja de cumplir no se rechaza en silencio: pasa a
  // observada con la nueva infracción a la vista de academia y organizador.
  const dejaDeCumplir =
    !resultado.valida && !ficha.tieneExcepcion && (ficha.estado === 'ENVIADA' || ficha.estado === 'APROBADA');
  await p.guardarValidacion(ficha.id, resultado, evento.reglamentoVersion, dejaDeCumplir ? 'OBSERVADA' : undefined);
  return ok(resultado);
}

/**
 * Envía la ficha: revalida y solo la marca enviada si cumple el reglamento o
 * tiene una excepción del organizador. Respeta ventana y bloqueo para la
 * academia; el organizador puede enviar fuera de término.
 */
export async function enviarFicha(p: PuertosFicha, fichaId: string, ahora: Date): Promise<Salida> {
  const carga = await cargar(p, fichaId);
  if (!carga.ok) return carga;
  const { ficha, evento, permisos } = carga.value;
  if (ficha.estado === 'RETIRADA') return err(errorDominio('FICHA_RETIRADA'));
  if (!permisos.gestor) {
    const ventana = estadoVentana(
      { apertura: evento.inscripcionApertura, cierre: evento.inscripcionCierre, cierreModificaciones: evento.modificacionesCierre },
      ahora,
    );
    if (ficha.bloqueada || (ventana !== 'ABIERTA' && ventana !== 'SOLO_MODIFICACIONES')) {
      return err(errorDominio('FICHA_NO_MODIFICABLE'));
    }
  }
  const resultado = ejecutarValidacion(ficha, evento);
  await p.guardarValidacion(ficha.id, resultado, evento.reglamentoVersion);
  if (!resultado.valida && !ficha.tieneExcepcion) {
    return err(errorDominio('FICHA_INVALIDA', { infracciones: resultado.infracciones.length }));
  }
  await p.marcarEnviada(ficha.id);
  return ok(resultado);
}
