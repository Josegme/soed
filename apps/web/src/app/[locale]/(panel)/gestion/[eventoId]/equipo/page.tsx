import type { Idioma } from '@soed/domain';
import { Aviso, CampoSelector, CampoTexto, EstadoVacio, Insignia, Tabla, Tarjeta, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { agregarMiembroAccion, quitarMiembroAccion } from '@/modules/eventos/interface/acciones';
import { equipoDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';

/** Equipo del evento por rol (OR-13, SA-04). Los roles salen del catálogo: uno nuevo aparece solo (ADR-0007). */
export default async function EquipoGestion({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, sesion, defecto } = await contextoGestion(eventoId, 'equipo');
  const { miembros, roles } = await equipoDeGestion(db, eventoId);
  const t = await getTranslations('gestion.equipo');
  const tc = await getTranslations('comun');
  const nombreRol = new Map(roles.map((r) => [r.codigo, texto(r.nombre, idioma, defecto)]));
  const asignables = roles.filter((r) => r.codigo !== 'ORGANIZADOR_EVENTO' || sesion.esSuperAdmin);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="titulo-equipo" className="flex flex-col gap-3">
        <h2 id="titulo-equipo" className="font-display text-xl font-bold">
          {t('miembros', { cantidad: miembros.length })}
        </h2>
        {miembros.length === 0 ? (
          <EstadoVacio titulo={t('sinMiembros')} />
        ) : (
          <Tabla>
            <caption className="sr-only">{t('miembros', { cantidad: miembros.length })}</caption>
            <thead>
              <tr>
                <Th scope="col">{tc('nombre')}</Th>
                <Th scope="col">{t('rol')}</Th>
                <Th scope="col">
                  <span className="sr-only">{tc('acciones')}</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <tr key={`${m.usuario_id}-${m.rol}`} className="border-t border-borde">
                  <Td>
                    <span className="font-medium">{m.nombre || m.email}</span>
                    {m.nombre ? <span className="block text-xs text-texto-suave">{m.email}</span> : null}
                  </Td>
                  <Td>
                    <Insignia tono={m.rol === 'ORGANIZADOR_EVENTO' ? 'marca' : 'neutro'}>{nombreRol.get(m.rol) ?? m.rol}</Insignia>
                  </Td>
                  <Td className="text-right">
                    {m.rol !== 'ORGANIZADOR_EVENTO' || sesion.esSuperAdmin ? (
                      <FormularioAccion
                        accion={quitarMiembroAccion}
                        namespace="gestion.equipo"
                        boton={tc('quitar')}
                        variante="fantasma"
                        tamano="chico"
                        enLinea
                      >
                        <input type="hidden" name="eventoId" value={eventoId} />
                        <input type="hidden" name="usuarioId" value={m.usuario_id} />
                        <input type="hidden" name="rol" value={m.rol} />
                      </FormularioAccion>
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Tabla>
        )}
      </section>
      <aside aria-labelledby="titulo-agregar">
        <Tarjeta className="flex flex-col gap-4">
          <h2 id="titulo-agregar" className="font-display text-lg font-bold">
            {t('agregar')}
          </h2>
          <Aviso tono="info">{t('aclaracionCuenta')}</Aviso>
          <FormularioAccion accion={agregarMiembroAccion} namespace="gestion.equipo" boton={tc('agregar')}>
            <input type="hidden" name="eventoId" value={eventoId} />
            <CampoTexto name="email" type="email" etiqueta={t('email')} requerido textoRequerido={tc('requerido')} autoComplete="off" />
            <CampoSelector
              name="rol"
              etiqueta={t('rol')}
              opciones={asignables.map((r) => ({ valor: r.codigo, etiqueta: texto(r.nombre, idioma, defecto) }))}
            />
          </FormularioAccion>
        </Tarjeta>
      </aside>
    </div>
  );
}
