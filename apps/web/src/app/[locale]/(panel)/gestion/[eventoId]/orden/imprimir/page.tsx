import type { Idioma } from '@soed/domain';
import { EstadoVacio, Tabla, Td, Th } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { BotonImprimir } from '@/components/boton-imprimir';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { formatearDuracion, formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe, NOMBRE_IDIOMA } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { ordenDeGestion } from '@/modules/gestion/infrastructure/consultas';
import { contextoGestion } from '@/modules/gestion/interface/contexto';
import { horariosDeBloque, type ConfigOperacion } from '@/modules/orden/interface/horarios';

/**
 * Orden del día para imprimir o guardar como PDF desde el navegador (OR-40).
 * El idioma del documento es el de la ruta: /es o /pt.
 */
export default async function OrdenDelDia({ params }: { params: Promise<{ locale: string; eventoId: string }> }) {
  const { locale, eventoId } = await params;
  const idioma: Idioma = idiomaDe(locale);
  const { db, evento, defecto } = await contextoGestion(eventoId, 'orden');
  const pistas = await ordenDeGestion(db, eventoId);
  const t = await getTranslations('gestion.orden');
  const tv = await getTranslations('eventos');
  const config = evento.config_operacion as ConfigOperacion;
  const reglamento = evento.reglamentoTipado;
  const codigo = (tipo: 'formaciones' | 'categorias' | 'generos', c: string | null) =>
    c && reglamento ? nombreCodigo(reglamento, tipo, c, idioma) : (c ?? '');
  const hora = (instante: Date | string) => formatearInstante(instante, idioma, evento.zona_horaria, { timeStyle: 'short' });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <nav aria-label={t('idiomaDocumento')} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-texto-suave">{t('idiomaDocumento')}</span>
          {routing.locales.map((l) => (
            <Link
              key={l}
              href={`/gestion/${eventoId}/orden/imprimir`}
              locale={l}
              aria-current={l === idioma ? 'page' : undefined}
              className="rounded-md px-2 py-1 font-medium text-marca underline-offset-4 hover:underline aria-[current=page]:bg-superficie-2 aria-[current=page]:text-texto"
            >
              {NOMBRE_IDIOMA[l]}
            </Link>
          ))}
        </nav>
        <BotonImprimir etiqueta={t('imprimir')} />
      </div>

      <header className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-bold">{t('ordenDelDia')}</h2>
        <p className="text-sm text-texto-suave">
          {t('generado', { fecha: formatearInstante(new Date(), idioma, evento.zona_horaria) })} ·{' '}
          {tv('zonaHoraria', { zona: evento.zona_horaria })}
        </p>
      </header>

      {pistas.length === 0 ? <EstadoVacio titulo={t('sinPistas')} /> : null}

      {pistas.map((p) => (
        <section
          key={p.id}
          aria-labelledby={`pista-${p.id}`}
          className="flex flex-col gap-4 print:break-before-page print:first:break-before-auto"
        >
          <h3 id={`pista-${p.id}`} className="font-display text-xl font-bold">
            {texto(p.nombre, idioma, defecto)}
          </h3>
          {p.bloques.length === 0 ? <p className="text-sm text-texto-suave">{t('sinBloques')}</p> : null}
          {p.bloques.map((b) => {
            const horarios = horariosDeBloque(b, config);
            return (
              <div key={b.id} className="flex flex-col gap-2">
                <h4 className="font-semibold">
                  {texto(b.nombre, idioma, defecto)} · {b.inicio ? t('inicio', { hora: hora(b.inicio) }) : t('sinHorario')}
                </h4>
                {b.items.length === 0 ? (
                  <p className="text-sm text-texto-suave">{t('coreografias', { cantidad: 0 })}</p>
                ) : (
                  <Tabla className="print:text-xs">
                    <caption className="sr-only">
                      {texto(p.nombre, idioma, defecto)} · {texto(b.nombre, idioma, defecto)}
                    </caption>
                    <thead>
                      <tr>
                        <Th className="w-12 text-right">{tv('posicion')}</Th>
                        <Th className="w-20">{t('horaEstimada')}</Th>
                        <Th>{tv('coreografia')}</Th>
                        <Th>{tv('academia')}</Th>
                        <Th>{tv('categoria')}</Th>
                        <Th>{tv('formacion')}</Th>
                        <Th>{tv('genero')}</Th>
                        <Th className="text-right">{t('duracion')}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.items.map((i) => {
                        const estimada = horarios?.get(i.id);
                        return (
                          <tr key={i.id} className="break-inside-avoid">
                            <Td className="text-right font-mono tabular-nums">{i.posicion}</Td>
                            <Td className="tabular-nums">{estimada ? hora(estimada) : '—'}</Td>
                            <Td className="font-medium">{i.nombre}</Td>
                            <Td>{i.academia}</Td>
                            <Td>{codigo('categorias', i.categoria)}</Td>
                            <Td>{codigo('formaciones', i.formacion)}</Td>
                            <Td>{codigo('generos', i.genero)}</Td>
                            <Td className="text-right tabular-nums">{i.duracion ? formatearDuracion(i.duracion) : '—'}</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Tabla>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
