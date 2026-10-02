import { horarioEstimado, type EstadoOrden, type Idioma } from '@soed/domain';
import { Aviso, CampoSelector, CampoTexto, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { formatearDuracion, formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { fichasSinOrden, ordenDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import {
  asignarFichasAccion,
  crearBloqueAccion,
  crearPistaAccion,
  moverItemAccion,
  publicarOrdenAccion,
  quitarItemAccion,
} from '@/modules/orden/interface/acciones';

const TONO: Record<string, 'neutro' | 'info' | 'alerta' | 'exito' | 'error'> = {
  PROGRAMADA: 'neutro',
  LLAMADA: 'info',
  EN_ESCENA: 'alerta',
  PRESENTADA: 'exito',
  AUSENTE: 'error',
};

/** Construcción del orden de salida por pista y bloque (OR-35 a OR-39). */
export default async function OrdenGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, puede, defecto } = await contextoGestion(eventoId, 'orden');
  const [pistas, sinOrden] = await Promise.all([ordenDeGestion(db, eventoId), fichasSinOrden(db, eventoId)]);
  const t = await getTranslations('gestion.orden');
  const te = await getTranslations('estados.orden');
  const tc = await getTranslations('comun');
  const config = evento.config_operacion as { intervaloSegundos?: number; duracionPorDefectoSegundos?: number };
  const reglamento = evento.reglamentoTipado;
  const codigo = (tipo: 'formaciones' | 'categorias' | 'generos', c: string | null) =>
    c && reglamento ? nombreCodigo(reglamento, tipo, c, idioma) : (c ?? '');
  const todosLosBloques = pistas.flatMap((p) =>
    p.bloques.map((b) => ({ valor: b.id, etiqueta: `${texto(p.nombre, idioma, defecto)} · ${texto(b.nombre, idioma, defecto)}` })),
  );
  const camposNombre = (prefijo: string) => (
    <CamposTraducibles nombre={prefijo} etiqueta={tc('nombre')} requerido textoRequerido={tc('requerido')} maxLength={120} />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm" role="status">
          {sinOrden > 0 ? t('fichasSinOrden', { cantidad: sinOrden }) : t('todasAsignadas')}
        </p>
        {puede('resultados.publicar') ? (
          <FormularioAccion
            accion={publicarOrdenAccion}
            namespace="gestion.orden"
            boton={evento.orden_publicado_at ? t('retirarPublicacion') : t('publicar')}
            variante={evento.orden_publicado_at ? 'secundario' : 'primario'}
            tamano="chico"
            enLinea
          >
            <input type="hidden" name="eventoId" value={eventoId} />
            <input type="hidden" name="publicar" value={evento.orden_publicado_at ? 'false' : 'true'} />
          </FormularioAccion>
        ) : null}
      </div>
      {evento.orden_publicado_at ? (
        <Aviso tono="info">
          {t('publicadoDesde', { fecha: formatearInstante(evento.orden_publicado_at, idioma, evento.zona_horaria) })}
        </Aviso>
      ) : null}

      {pistas.length === 0 ? <EstadoVacio titulo={t('sinPistas')} /> : null}

      {pistas.map((p) => (
        <section key={p.id} aria-labelledby={`pista-${p.id}`} className="flex flex-col gap-4">
          <h2 id={`pista-${p.id}`} className="font-display text-xl font-bold">
            {texto(p.nombre, idioma, defecto)}
          </h2>
          {p.bloques.length === 0 ? <p className="text-sm text-texto-suave">{t('sinBloques')}</p> : null}
          {p.bloques.map((b) => {
            const horarios = b.inicio
              ? new Map(
                  horarioEstimado(
                    b.items.map((i) => ({
                      id: i.id,
                      fichaId: i.fichaId,
                      bloqueId: b.id,
                      posicion: i.posicion,
                      estado: i.estado as EstadoOrden,
                      duracionSegundos: i.duracion,
                    })),
                    new Date(b.inicio),
                    {
                      intervaloSegundos: config.intervaloSegundos ?? 60,
                      duracionPorDefectoSegundos: config.duracionPorDefectoSegundos ?? 240,
                    },
                  ).map((h) => [h.itemId, h.inicio]),
                )
              : null;
            return (
              <Tarjeta key={b.id} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg font-bold">{texto(b.nombre, idioma, defecto)}</h3>
                    <p className="text-sm text-texto-suave">
                      {b.inicio ? t('inicio', { hora: formatearInstante(b.inicio, idioma, evento.zona_horaria) }) : t('sinHorario')} ·{' '}
                      {t('coreografias', { cantidad: b.items.length })}
                    </p>
                  </div>
                  {sinOrden > 0 ? (
                    <FormularioAccion
                      accion={asignarFichasAccion}
                      namespace="gestion.orden"
                      boton={t('asignar')}
                      variante="secundario"
                      tamano="chico"
                      enLinea
                    >
                      <input type="hidden" name="bloqueId" value={b.id} />
                    </FormularioAccion>
                  ) : null}
                </div>
                {b.items.length > 0 ? (
                  <ol className="flex flex-col divide-y divide-borde">
                    {b.items.map((i, n) => (
                      <li key={i.id} className="flex flex-wrap items-center gap-3 py-2">
                        <span className="w-8 shrink-0 text-right font-mono text-sm tabular-nums text-texto-suave">{i.posicion}</span>
                        <div className="min-w-48 flex-1">
                          <p className="font-medium">{i.nombre}</p>
                          <p className="text-xs text-texto-suave">
                            {i.academia} · {codigo('categorias', i.categoria)} · {codigo('formaciones', i.formacion)} ·{' '}
                            {codigo('generos', i.genero)}
                            {i.duracion ? ` · ${formatearDuracion(i.duracion)}` : ''}
                            {horarios?.get(i.id)
                              ? ` · ${t('estimado', { hora: formatearInstante(horarios.get(i.id)!, idioma, evento.zona_horaria, { timeStyle: 'short' }) })}`
                              : ''}
                          </p>
                        </div>
                        <Insignia tono={TONO[i.estado]}>{te(i.estado as 'PROGRAMADA')}</Insignia>
                        <div className="flex flex-wrap items-center gap-1">
                          {n > 0 ? (
                            <FormularioAccion
                              accion={moverItemAccion}
                              namespace="gestion.orden"
                              boton={t('subir')}
                              variante="fantasma"
                              tamano="chico"
                              enLinea
                            >
                              <input type="hidden" name="itemId" value={i.id} />
                              <input type="hidden" name="bloqueId" value={b.id} />
                              <input type="hidden" name="posicion" value={i.posicion - 1} />
                            </FormularioAccion>
                          ) : null}
                          {n < b.items.length - 1 ? (
                            <FormularioAccion
                              accion={moverItemAccion}
                              namespace="gestion.orden"
                              boton={t('bajar')}
                              variante="fantasma"
                              tamano="chico"
                              enLinea
                            >
                              <input type="hidden" name="itemId" value={i.id} />
                              <input type="hidden" name="bloqueId" value={b.id} />
                              <input type="hidden" name="posicion" value={i.posicion + 1} />
                            </FormularioAccion>
                          ) : null}
                          <details className="relative">
                            <summary className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium hover:bg-superficie-2">
                              {t('mover')}
                            </summary>
                            <FormularioAccion
                              accion={moverItemAccion}
                              namespace="gestion.orden"
                              boton={t('confirmarMover')}
                              tamano="chico"
                              className="mt-2 min-w-64"
                            >
                              <input type="hidden" name="itemId" value={i.id} />
                              <CampoSelector name="bloqueId" etiqueta={t('bloque')} defaultValue={b.id} opciones={todosLosBloques} />
                              <CampoTexto
                                name="posicion"
                                type="number"
                                min={1}
                                etiqueta={t('posicion')}
                                defaultValue={String(i.posicion)}
                              />
                            </FormularioAccion>
                          </details>
                          {i.estado === 'PROGRAMADA' ? (
                            <FormularioAccion
                              accion={quitarItemAccion}
                              namespace="gestion.orden"
                              boton={t('quitar')}
                              variante="fantasma"
                              tamano="chico"
                              enLinea
                            >
                              <input type="hidden" name="itemId" value={i.id} />
                            </FormularioAccion>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </Tarjeta>
            );
          })}
          <details>
            <summary className="cursor-pointer text-sm font-medium text-marca">{t('nuevoBloque')}</summary>
            <FormularioAccion
              accion={crearBloqueAccion}
              namespace="gestion.orden"
              boton={tc('crear')}
              variante="secundario"
              className="mt-3 max-w-xl"
            >
              <input type="hidden" name="pistaId" value={p.id} />
              {camposNombre('nombre')}
              <CampoTexto
                name="inicio"
                type="datetime-local"
                etiqueta={t('inicioProgramado')}
                ayuda={t('zonaHoraria', { zona: evento.zona_horaria })}
              />
            </FormularioAccion>
          </details>
        </section>
      ))}

      {puede('evento.configurar') ? (
        <details className="rounded-[var(--radio)] border border-dashed border-borde p-4">
          <summary className="cursor-pointer font-medium">{t('nuevaPista')}</summary>
          <FormularioAccion
            accion={crearPistaAccion}
            namespace="gestion.orden"
            boton={tc('crear')}
            variante="secundario"
            className="mt-3 max-w-xl"
          >
            <input type="hidden" name="eventoId" value={eventoId} />
            {camposNombre('nombre')}
          </FormularioAccion>
        </details>
      ) : null}
    </div>
  );
}
