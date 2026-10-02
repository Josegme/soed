import { MONEDAS, type Idioma } from '@soed/domain';
import { CampoSelector, CampoTexto, EncabezadoPagina, Tarjeta } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { requerirSesion } from '@/lib/auth/sesion';
import { IDIOMAS_SOPORTADOS, idiomaDe, NOMBRE_IDIOMA } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { crearEventoAccion } from '@/modules/eventos/interface/acciones';
import { panelAdmin } from '@/modules/gestion/infrastructure/consultas-admin';

/** Alta de un evento independiente, desde el reglamento de la temporada o clonando otro (SA-02, SA-03). */
export default async function NuevoEvento({ params }: { params: Promise<{ locale: string }> }) {
  const idioma: Idioma = idiomaDe((await params).locale);
  const { db } = await requerirSesion();
  const { temporadas, eventos } = await panelAdmin(db);
  const t = await getTranslations('admin.nuevo');
  const tc = await getTranslations('comun');
  const zonas = Intl.supportedValuesOf('timeZone').filter((z) => /^(America|Europe|Atlantic)\//.test(z) || z === 'UTC');

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <EncabezadoPagina titulo={t('titulo')} descripcion={t('descripcion')} />
      <Tarjeta>
        <FormularioAccion accion={crearEventoAccion} namespace="admin.nuevo" boton={t('crear')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoSelector
              name="temporadaId"
              etiqueta={t('temporada')}
              opciones={temporadas.map((x) => ({ valor: x.id, etiqueta: texto(x.nombre, idioma) }))}
            />
            <CampoSelector
              name="tipo"
              etiqueta={t('tipo')}
              opciones={(['SELECTIVO', 'FINAL', 'UNICO'] as const).map((x) => ({ valor: x, etiqueta: t(`tipos.${x}`) }))}
            />
            <CampoTexto
              name="slug"
              etiqueta={t('slug')}
              ayuda={t('ayudaSlug')}
              requerido
              textoRequerido={tc('requerido')}
              maxLength={16}
              className="uppercase"
            />
            <CampoSelector
              name="moneda"
              etiqueta={t('moneda')}
              ayuda={t('ayudaMoneda')}
              opciones={MONEDAS.map((m) => ({ valor: m, etiqueta: m }))}
            />
          </div>
          <CamposTraducibles nombre="nombre" etiqueta={tc('nombre')} requerido textoRequerido={tc('requerido')} maxLength={200} />
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTexto name="fechaInicio" type="date" etiqueta={t('fechaInicio')} requerido textoRequerido={tc('requerido')} />
            <CampoTexto name="fechaFin" type="date" etiqueta={t('fechaFin')} requerido textoRequerido={tc('requerido')} />
            <CampoSelector
              name="zonaHoraria"
              etiqueta={t('zonaHoraria')}
              defaultValue="America/Sao_Paulo"
              opciones={zonas.map((z) => ({ valor: z, etiqueta: z }))}
            />
            <CampoSelector
              name="idiomaDefecto"
              etiqueta={t('idiomaDefecto')}
              opciones={IDIOMAS_SOPORTADOS.map((i) => ({ valor: i, etiqueta: NOMBRE_IDIOMA[i] }))}
            />
            <CampoTexto name="ciudad" etiqueta={t('ciudad')} />
            <CampoTexto name="pais" etiqueta={t('pais')} />
          </div>
          <CampoSelector
            name="clonarDeEventoId"
            etiqueta={t('clonar')}
            ayuda={t('ayudaClonar')}
            vacio={t('sinClonar')}
            opciones={eventos.map((e) => ({ valor: e.id, etiqueta: `${e.slug} · ${texto(e.nombre, idioma, e.idioma_defecto as Idioma)}` }))}
          />
        </FormularioAccion>
      </Tarjeta>
    </div>
  );
}
