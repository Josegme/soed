import type { Idioma, Moneda, Traducible } from '@soed/domain';
import { CampoTexto, EncabezadoPagina, estilosBoton, Tarjeta } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BuscadorQr } from '@/components/buscador-qr';
import { EstadoCola } from '@/components/estado-cola';
import { FormularioAccion } from '@/components/formulario-accion';
import { requerirPermiso } from '@/lib/auth/sesion';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { abrirTurnoAccion } from '@/modules/cobros/interface/acciones';
import { TablaLiquidaciones } from '@/modules/cobros/interface/panel-cobros';
import { cobrosDeGestion, liquidacionesDeGestion, liquidacionPorQr, turnosDeCaja } from '@/modules/gestion/infrastructure/consultas';

/** Mesa de cobros del staff (OP-20, OP-21): búsqueda por academia y cobro con cola offline. */
export default async function Caja({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; eventoId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale, eventoId } = await params;
  const { q } = await searchParams;
  const idioma: Idioma = idiomaDe(locale);
  const { db, sesion } = await requerirPermiso(eventoId, 'cobros.registrar');
  const { data: evento } = await db
    .from('evento')
    .select('nombre, idioma_defecto, zona_horaria, moneda, medios_cobro')
    .eq('id', eventoId)
    .maybeSingle();
  if (!evento) notFound();
  const [todas, cobros, turnos] = await Promise.all([
    liquidacionesDeGestion(db, eventoId),
    cobrosDeGestion(db, eventoId, 500),
    turnosDeCaja(db, eventoId),
  ]);
  const filtro = (q ?? '').trim().toLowerCase();
  const porQr = filtro ? await liquidacionPorQr(db, filtro) : null;
  const liquidaciones = filtro
    ? todas.filter((l) => l.id === porQr || l.academia.toLowerCase().includes(filtro) || l.numero.toLowerCase().includes(filtro))
    : todas;
  const t = await getTranslations('caja');
  const tc = await getTranslations('comun');
  const moneda = evento.moneda as Moneda;
  const miTurno = turnos.find((x) => x.usuario_id === sesion.usuarioId && !x.cerrado_at);
  const mios = cobros.filter((c) => c.registrado_por === sesion.usuarioId && !c.anulado_at && (!miTurno || c.turno_caja_id === miTurno.id));
  const totalMio = mios.reduce((s, c) => s + Number(c.monto_centavos), 0);

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={texto(evento.nombre as Traducible, idioma, evento.idioma_defecto as Idioma)} />
      <EstadoCola usuarioId={sesion.usuarioId} />
      <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          {miTurno
            ? t('turno', {
                desde: formatearInstante(miTurno.abierto_at, idioma, evento.zona_horaria, { timeStyle: 'short' }),
                cantidad: mios.length,
                monto: formatearMonto(totalMio, moneda, idioma),
              })
            : t('sinTurno', { cantidad: mios.length, monto: formatearMonto(totalMio, moneda, idioma) })}
        </p>
        {!miTurno ? (
          <FormularioAccion
            accion={abrirTurnoAccion}
            namespace="gestion.cobros"
            boton={t('abrirTurno')}
            variante="secundario"
            tamano="chico"
            enLinea
          >
            <input type="hidden" name="eventoId" value={eventoId} />
          </FormularioAccion>
        ) : null}
      </Tarjeta>
      <p className="text-sm text-texto-suave">{t('aclaracion')}</p>
      <BuscadorQr />
      <form method="get" className="flex flex-wrap items-end gap-2">
        <CampoTexto name="q" etiqueta={t('buscar')} defaultValue={q ?? ''} />
        <button type="submit" className={estilosBoton({ variante: 'secundario' })}>
          {tc('buscar')}
        </button>
      </form>
      <TablaLiquidaciones
        liquidaciones={liquidaciones}
        moneda={moneda}
        medios={evento.medios_cobro}
        idioma={idioma}
        puedeCobrar
        offline={{ usuarioId: sesion.usuarioId }}
      />
    </div>
  );
}
