import type { Idioma } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { Aviso, CampoArea, EncabezadoPagina, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { requerirSesion } from '@/lib/auth/sesion';
import { formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { nuevaVersionReglamentoAccion } from '@/modules/temporadas/interface/acciones';
import { EnlacesTemporada } from '@/modules/temporadas/interface/enlaces';

/** Reglamento de la temporada: versión vigente, historial y nueva versión (SA-07, TR-11). */
export default async function ReglamentoTemporada({ params }: { params: Promise<{ locale: string; temporadaId: string }> }) {
  const { locale, temporadaId } = await params;
  if (!uuidSchema.safeParse(temporadaId).success) notFound();
  const idioma: Idioma = idiomaDe(locale);
  const { db } = await requerirSesion();
  const { data: temporada } = await db
    .from('temporada')
    .select('id, nombre, reglamento:reglamento_id (id, nombre, preset, version, config)')
    .eq('id', temporadaId)
    .maybeSingle();
  if (!temporada) notFound();
  const actual = temporada.reglamento;
  const { data: versiones } = actual?.preset
    ? await db.from('reglamento').select('id, version, creado_at').eq('preset', actual.preset).order('version', { ascending: false })
    : { data: [] };
  const t = await getTranslations('admin.reglamentoTemporada');
  const zona = 'UTC';

  return (
    <div className="flex flex-col gap-6">
      <EncabezadoPagina
        titulo={t('titulo', { temporada: texto(temporada.nombre, idioma) })}
        descripcion={t('descripcion')}
        acciones={<EnlacesTemporada temporadaId={temporadaId} actual="reglamento" />}
      />
      {!actual ? (
        <Aviso tono="alerta">{t('sinReglamento')}</Aviso>
      ) : (
        <>
          <Tarjeta className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg font-bold">{texto(actual.nombre, idioma)}</p>
            <Insignia tono="marca">{t('version', { version: actual.version })}</Insignia>
            {actual.preset ? <Insignia tono="info">{t('preset', { preset: actual.preset })}</Insignia> : null}
          </Tarjeta>
          <Aviso tono="info">{t('aclaracion')}</Aviso>
          {(versiones ?? []).length > 0 ? (
            <Tabla>
              <caption className="sr-only">{t('historial')}</caption>
              <thead>
                <tr>
                  <Th>{t('columnaVersion')}</Th>
                  <Th>{t('creada')}</Th>
                  <Th>{t('estado')}</Th>
                </tr>
              </thead>
              <tbody>
                {(versiones ?? []).map((v) => (
                  <tr key={v.id}>
                    <Td className="tabular-nums">{v.version}</Td>
                    <Td className="tabular-nums">
                      {formatearInstante(v.creado_at, idioma, zona, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Td>
                    <Td>{v.id === actual.id ? <Insignia tono="exito">{t('vigente')}</Insignia> : null}</Td>
                  </tr>
                ))}
              </tbody>
            </Tabla>
          ) : null}
          {actual.preset ? (
            <FormularioAccion
              accion={nuevaVersionReglamentoAccion}
              namespace="admin.reglamentoTemporada"
              boton={t('desdePreset')}
              variante="secundario"
              tamano="chico"
              enLinea
            >
              <input type="hidden" name="temporadaId" value={temporadaId} />
              <input type="hidden" name="origen" value="preset" />
            </FormularioAccion>
          ) : null}
          <Tarjeta>
            <FormularioAccion accion={nuevaVersionReglamentoAccion} namespace="admin.reglamentoTemporada" boton={t('guardarVersion')}>
              <input type="hidden" name="temporadaId" value={temporadaId} />
              <input type="hidden" name="origen" value="json" />
              <CampoArea
                name="reglamento"
                etiqueta={t('json')}
                ayuda={t('jsonAyuda')}
                defaultValue={JSON.stringify(actual.config, null, 2)}
                className="min-h-96 font-mono text-xs"
                spellCheck={false}
              />
            </FormularioAccion>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
