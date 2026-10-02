import { CampoTexto } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { FormularioAccion } from '@/components/formulario-accion';
import { reservarPublicaAccion } from './acciones';

/**
 * Formulario de reserva sin cuenta (PU-09, PU-10). El campo `sitio_web` es una
 * trampa para bots: queda fuera de pantalla y del árbol de accesibilidad.
 */
export async function FormularioReservaPublica({
  tipo,
  id,
  maximo,
  etiqueta,
}: {
  tipo: 'clase' | 'entrada';
  id: string;
  maximo: number;
  etiqueta: string;
}) {
  const t = await getTranslations('eventos.reservas');
  const tc = await getTranslations('comun');
  return (
    <FormularioAccion accion={reservarPublicaAccion} namespace="eventos.reservas" boton={t('reservar')} tamano="chico" className="relative">
      <input type="hidden" name="tipo" value={tipo} />
      <input type="hidden" name="id" value={id} />
      <div aria-hidden="true" className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden">
        <label>
          {t('trampa')}
          <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoTexto name="nombre" etiqueta={t('nombre')} autoComplete="name" requerido textoRequerido={tc('requerido')} maxLength={200} />
        <CampoTexto
          name="email"
          type="email"
          etiqueta={t('email')}
          autoComplete="email"
          requerido
          textoRequerido={tc('requerido')}
          maxLength={320}
        />
        {tipo === 'entrada' ? (
          <CampoTexto
            name="cantidad"
            type="number"
            min={1}
            max={Math.min(20, maximo)}
            etiqueta={t('cantidad')}
            defaultValue="1"
            requerido
            textoRequerido={tc('requerido')}
          />
        ) : null}
      </div>
      <p className="text-xs text-texto-suave">{t('aclaracion', { item: etiqueta })}</p>
    </FormularioAccion>
  );
}
