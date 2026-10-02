import type { ConfigAcreditacion, Idioma, Traducible } from '@soed/domain';
import {
  CampoTexto,
  EncabezadoPagina,
  EstadoVacio,
  estilosBoton,
  GrupoIndicadores,
  Indicador,
  Insignia,
  Tabla,
  Tarjeta,
  Td,
  Th,
} from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { EstadoCola } from '@/components/estado-cola';
import { FormularioAccion } from '@/components/formulario-accion';
import { Link } from '@/i18n/navigation';
import { requerirPermiso, tienePermiso } from '@/lib/auth/sesion';
import { libre } from '@/lib/i18n/claves';
import { formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { credencialesDelEvento, resumenAcreditacion } from '@/modules/acreditacion/infrastructure/consultas';
import { emitirCredencialesAccion } from '@/modules/acreditacion/interface/acciones';
import { BotonAcreditar, EscanerAcreditacion } from '@/modules/acreditacion/interface/escaner';

/** Puesto de acreditación (OP-14 a OP-19): escaneo, búsqueda y emisión de credenciales. */
export default async function Acreditacion({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale, eventoId } = await params;
  const { q } = await searchParams;
  const idioma: Idioma = idiomaDe(locale);
  const { db, sesion } = await requerirPermiso(eventoId, 'acreditacion.operar');
  const { data: evento } = await db
    .from('evento')
    .select('nombre, idioma_defecto, zona_horaria, acreditacion')
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) notFound();
  const [resumen, credenciales] = await Promise.all([resumenAcreditacion(db, eventoId), credencialesDelEvento(db, eventoId, { q })]);
  const t = await getTranslations('acreditacion');
  const tt = libre(await getTranslations('acreditacion.tipos'));
  const tc = await getTranslations('comun');
  const horario = ((evento.acreditacion ?? {}) as ConfigAcreditacion).horario;

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('titulo')}
        descripcion={texto(evento.nombre as Traducible, idioma, evento.idioma_defecto as Idioma)}
        acciones={
          tienePermiso(sesion, eventoId, 'cobros.registrar') ? (
            <Link href={`/acreditacion/${eventoId}/caja`} className={estilosBoton({ variante: 'secundario' })}>
              {t('irCaja')}
            </Link>
          ) : null
        }
      />
      {horario?.apertura && horario.cierre ? (
        <p className="text-sm text-texto-suave">
          {t('horario', {
            apertura: formatearInstante(horario.apertura, idioma, evento.zona_horaria),
            cierre: formatearInstante(horario.cierre, idioma, evento.zona_horaria),
          })}
        </p>
      ) : null}
      <EstadoCola usuarioId={sesion.usuarioId} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <Tarjeta className="flex flex-col gap-4">
          <h2 className="font-display text-xl font-bold">{t('escanear')}</h2>
          <p className="text-sm text-texto-suave">{t('aclaracionDeuda')}</p>
          <EscanerAcreditacion usuarioId={sesion.usuarioId} zonaHoraria={evento.zona_horaria} />
        </Tarjeta>
        <div className="flex flex-col gap-4">
          <GrupoIndicadores>
            <Indicador etiqueta={t('acreditadas')} valor={`${resumen.acreditadas} / ${resumen.total}`} />
          </GrupoIndicadores>
          <Tarjeta className="flex flex-col gap-3">
            <FormularioAccion
              accion={emitirCredencialesAccion}
              namespace="acreditacion"
              boton={t('emitir')}
              variante="secundario"
              tamano="chico"
            >
              <input type="hidden" name="eventoId" value={eventoId} />
              <p className="text-sm text-texto-suave">{t('ayudaEmitir')}</p>
            </FormularioAccion>
            <Link
              href={`/acreditacion/${eventoId}/credenciales`}
              className="text-sm font-medium text-marca underline-offset-4 hover:underline"
            >
              {t('imprimir')}
            </Link>
          </Tarjeta>
        </div>
      </div>

      <section aria-labelledby="titulo-credenciales" className="flex flex-col gap-3">
        <h2 id="titulo-credenciales" className="font-display text-xl font-bold">
          {t('credenciales')}
        </h2>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <CampoTexto name="q" etiqueta={tc('buscar')} defaultValue={q ?? ''} />
          <button type="submit" className={estilosBoton({ variante: 'secundario' })}>
            {tc('buscar')}
          </button>
        </form>
        {credenciales.length === 0 ? (
          <EstadoVacio titulo={t('sinCredenciales')} descripcion={t('sinCredencialesDetalle')} />
        ) : (
          <Tabla>
            <caption className="sr-only">{t('credenciales')}</caption>
            <thead>
              <tr>
                <Th scope="col">{tc('nombre')}</Th>
                <Th scope="col">{t('tipo')}</Th>
                <Th scope="col">{t('academia')}</Th>
                <Th scope="col" className="text-right">
                  {tc('estado')}
                </Th>
              </tr>
            </thead>
            <tbody>
              {credenciales.map((c) => (
                <tr key={c.id} className="border-t border-borde">
                  <Td className="font-medium">{c.nombre}</Td>
                  <Td>{tt.has(c.tipo) ? tt(c.tipo) : c.tipo}</Td>
                  <Td>{c.academia ?? ''}</Td>
                  <Td className="text-right">
                    {c.anulada ? (
                      <Insignia tono="error">{t('anulada')}</Insignia>
                    ) : c.acreditadoAt ? (
                      <Insignia tono="exito">
                        {t('acreditadaA', { hora: formatearInstante(c.acreditadoAt, idioma, evento.zona_horaria, { timeStyle: 'short' }) })}
                      </Insignia>
                    ) : (
                      <BotonAcreditar usuarioId={sesion.usuarioId} qrToken={c.qrToken} nombre={c.nombre} />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>
    </div>
  );
}
