import type { Idioma, ReglamentoEvento, Traducible } from '@soed/domain';
import { Aviso, EncabezadoPagina, EstadoVacio, Insignia, Tarjeta } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EnVivo } from '@/components/en-vivo';
import { EstadoCola } from '@/components/estado-cola';
import { Link } from '@/i18n/navigation';
import { requerirPermiso } from '@/lib/auth/sesion';
import { entornoPublico } from '@/lib/entorno';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { PlanillaJurado } from '@/modules/puntajes/interface/planilla-jurado';
import { configPuntaje, criteriosDelEvento, ordenEnVivo, planillasDelJurado } from '@/modules/vivo/infrastructure/consultas';

/** Planilla del jurado sobre el orden de salida (JU-01 a JU-06). */
export default async function Jurado({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ ficha?: string }>;
}) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, sesion } = await requerirPermiso(eventoId, 'puntajes.cargar');
  const { data: evento } = await db.from('evento').select('nombre, idioma_defecto, reglamento').eq('id', eventoId).maybeSingle();
  if (!evento) notFound();
  const [pistas, criterios, puntaje, propias] = await Promise.all([
    ordenEnVivo(db, eventoId),
    criteriosDelEvento(db, eventoId),
    configPuntaje(db, eventoId),
    planillasDelJurado(db, eventoId, sesion.usuarioId),
  ]);
  const t = await getTranslations('jurado');
  const tp = await getTranslations('estados.planilla');
  const defecto = evento.idioma_defecto as Idioma;
  const reglamento = evento.reglamento as unknown as ReglamentoEvento;
  const codigo = (tipo: 'categorias' | 'formaciones' | 'generos', c: string | null) => (c ? nombreCodigo(reglamento, tipo, c, idioma) : '');
  const items = pistas.flatMap((p) => p.bloques.flatMap((b) => b.items.filter((i) => i.estado !== 'AUSENTE')));
  const fichaPedida = (await searchParams).ficha;
  const elegida =
    items.find((i) => i.fichaId === fichaPedida) ??
    items.find((i) => i.estado === 'EN_ESCENA') ??
    items.find((i) => propias.get(i.fichaId)?.estado !== 'ENVIADA') ??
    items[0];
  const enviadas = items.filter((i) => propias.get(i.fichaId)?.estado === 'ENVIADA').length;
  const entorno = entornoPublico();

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('titulo')}
        descripcion={`${texto(evento.nombre as Traducible, idioma, defecto)} · ${t('avance', { enviadas, total: items.length })}`}
        acciones={
          <EnVivo url={entorno?.supabaseUrl ?? null} clave={entorno?.supabaseClave ?? null} eventoId={eventoId} tablas={['orden_item']} />
        }
      />
      <EstadoCola usuarioId={sesion.usuarioId} />
      {criterios.length === 0 || !puntaje ? <Aviso tono="alerta">{t('sinCriterios')}</Aviso> : null}
      {items.length === 0 ? (
        <EstadoVacio titulo={t('sinOrden')} descripcion={t('sinOrdenDetalle')} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
          <nav aria-label={t('orden')} className="order-2 lg:order-1">
            <ol className="flex flex-col gap-1">
              {items.map((i) => {
                const propia = propias.get(i.fichaId);
                const actual = i.id === elegida?.id;
                return (
                  <li key={i.id}>
                    <Link
                      href={`/jurado/${eventoId}?ficha=${i.fichaId}`}
                      aria-current={actual ? 'true' : undefined}
                      className="flex min-h-12 items-center gap-3 rounded-md border border-transparent px-3 py-2 text-sm hover:bg-superficie-2 aria-[current=true]:border-marca aria-[current=true]:bg-superficie"
                    >
                      <span className="w-6 shrink-0 text-right font-mono tabular-nums text-texto-suave">{i.posicion}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{i.nombre}</span>
                      {i.estado === 'EN_ESCENA' ? <Insignia tono="marca">{t('enEscena')}</Insignia> : null}
                      {propia ? <Insignia tono={propia.estado === 'ENVIADA' ? 'exito' : 'alerta'}>{tp(propia.estado)}</Insignia> : null}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
          {elegida && puntaje && criterios.length > 0 ? (
            <Tarjeta className="order-1 flex flex-col gap-5 lg:order-2">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-texto-suave">{t('posicion', { posicion: elegida.posicion })}</p>
                <h2 className="font-display text-2xl font-bold">{elegida.nombre}</h2>
                <p className="text-sm text-texto-suave">
                  {elegida.academia} · {codigo('categorias', elegida.categoria)} · {codigo('formaciones', elegida.formacion)} ·{' '}
                  {codigo('generos', elegida.genero)}
                </p>
              </div>
              <PlanillaJurado
                key={elegida.fichaId}
                usuarioId={sesion.usuarioId}
                fichaId={elegida.fichaId}
                fichaNombre={elegida.nombre}
                criterios={criterios.map((c) => ({ id: c.id, codigo: c.codigo, nombre: texto(c.nombre, idioma, defecto), peso: c.peso }))}
                puntaje={puntaje}
                existente={propias.get(elegida.fichaId) ?? null}
              />
            </Tarjeta>
          ) : null}
        </div>
      )}
    </div>
  );
}
