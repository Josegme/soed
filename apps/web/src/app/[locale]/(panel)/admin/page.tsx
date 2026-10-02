import type { EstadoEvento, Idioma } from '@soed/domain';
import { CampoSelector, CampoTexto, EncabezadoPagina, EstadoVacio, estilosBoton, Insignia, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { Link } from '@/i18n/navigation';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { crearTemporadaAccion } from '@/modules/eventos/interface/acciones';
import { panelAdmin } from '@/modules/gestion/infrastructure/consultas-admin';

/** Temporadas y eventos de la instancia (SA-01 a SA-05). */
export default async function Admin({ params }: { params: Promise<{ locale: string }> }) {
  const idioma: Idioma = idiomaDe((await params).locale);
  const { db } = await requerirSesion();
  const { temporadas, reglamentos } = await panelAdmin(db);
  const t = await getTranslations('admin');
  const te = await getTranslations('estados.evento');
  const tc = await getTranslations('comun');

  return (
    <div className="flex flex-col gap-8">
      <EncabezadoPagina
        titulo={t('titulo')}
        descripcion={t('descripcion')}
        acciones={
          temporadas.length > 0 ? (
            <Link href="/admin/eventos/nuevo" className={estilosBoton()}>
              {t('nuevoEvento')}
            </Link>
          ) : null
        }
      />

      {temporadas.length === 0 ? <EstadoVacio titulo={t('sinTemporadas')} descripcion={t('sinTemporadasDetalle')} /> : null}

      {temporadas.map((temporada) => (
        <section key={temporada.id} aria-labelledby={`temporada-${temporada.id}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id={`temporada-${temporada.id}`} className="font-display text-xl font-bold">
              {texto(temporada.nombre, idioma)}
            </h2>
            <Insignia tono={temporada.publicada ? 'exito' : 'neutro'}>{temporada.publicada ? t('publicada') : t('borrador')}</Insignia>
            <Link
              href={`/admin/temporadas/${temporada.id}`}
              className="text-sm font-medium text-marca underline-offset-4 hover:underline"
              aria-label={`${t('tablero')} · ${texto(temporada.nombre, idioma)}`}
            >
              {t('tablero')}
            </Link>
          </div>
          {temporada.eventos.length === 0 ? <p className="text-sm text-texto-suave">{t('sinEventos')}</p> : null}
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {temporada.eventos.map((e) => (
              <li key={e.id}>
                <Tarjeta className="flex h-full flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display text-lg font-bold">{texto(e.nombre, idioma, e.idioma_defecto as Idioma)}</p>
                    <Insignia tono={e.publicado ? 'exito' : 'neutro'}>{te(e.estado as EstadoEvento)}</Insignia>
                  </div>
                  <p className="text-sm text-texto-suave">
                    {e.slug} · {t(`tipos.${e.tipo as 'SELECTIVO' | 'FINAL' | 'UNICO'}`)} · {e.moneda}
                  </p>
                  <p className="text-sm">{formatearRangoFechas(e.fecha_inicio, e.fecha_fin, idioma)}</p>
                  {e.organizadores === 0 ? <p className="text-sm text-alerta">{t('sinOrganizador')}</p> : null}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Link href={`/gestion/${e.id}`} className={estilosBoton({ variante: 'secundario', tamano: 'chico' })}>
                      {t('gestionar')}
                    </Link>
                    <Link href={`/gestion/${e.id}/equipo`} className={estilosBoton({ variante: 'fantasma', tamano: 'chico' })}>
                      {t('equipo')}
                    </Link>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <details className="rounded-[var(--radio)] border border-dashed border-borde p-4">
        <summary className="cursor-pointer font-medium">{t('nuevaTemporada')}</summary>
        <FormularioAccion accion={crearTemporadaAccion} namespace="admin" boton={tc('crear')} className="mt-4 max-w-2xl">
          <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
            <CampoTexto
              name="anio"
              type="number"
              min={2000}
              max={2100}
              etiqueta={t('anio')}
              defaultValue={String(new Date().getFullYear() + 1)}
              requerido
              textoRequerido={tc('requerido')}
            />
            <CampoSelector
              name="reglamentoId"
              etiqueta={t('reglamento')}
              ayuda={t('ayudaReglamento')}
              opciones={reglamentos.map((r) => ({ valor: r.id, etiqueta: `${texto(r.nombre, idioma)} · v${r.version}` }))}
            />
          </div>
          <CamposTraducibles nombre="nombre" etiqueta={tc('nombre')} requerido textoRequerido={tc('requerido')} maxLength={120} />
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="publicada" className="size-5 accent-marca" />
            {t('publicarTemporada')}
          </label>
        </FormularioAccion>
      </details>
    </div>
  );
}
