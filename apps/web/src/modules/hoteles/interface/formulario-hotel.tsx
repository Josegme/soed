import { CampoSelector, CampoTexto } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import type { Hotel } from '../infrastructure/consultas';
import { guardarHotelAccion } from './acciones';

/** Alta o edición de un hotel o paquete (OR-09). */
export async function FormularioHotel({ eventoId, hotel, moneda }: { eventoId: string; hotel?: Hotel; moneda: string }) {
  const t = await getTranslations('gestion.hoteles');
  const tc = await getTranslations('comun');
  return (
    <FormularioAccion
      accion={guardarHotelAccion}
      namespace="gestion.hoteles"
      boton={hotel ? tc('guardar') : tc('crear')}
      tamano="chico"
      className="mt-3 max-w-2xl"
    >
      <input type="hidden" name="eventoId" value={eventoId} />
      {hotel ? <input type="hidden" name="hotelId" value={hotel.id} /> : null}
      <CampoTexto
        name="nombre"
        etiqueta={tc('nombre')}
        defaultValue={hotel?.nombre ?? ''}
        requerido
        textoRequerido={tc('requerido')}
        maxLength={200}
      />
      <CamposTraducibles nombre="descripcion" etiqueta={t('descripcion')} valor={hotel?.descripcion} area maxLength={2000} />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto
          name="cupo"
          type="number"
          min={0}
          etiqueta={t('cupo')}
          ayuda={t('cupoAyuda')}
          defaultValue={hotel ? String(hotel.cupo) : ''}
          requerido
          textoRequerido={tc('requerido')}
        />
        <CampoTexto
          name="precio"
          inputMode="decimal"
          etiqueta={t('precio', { moneda })}
          defaultValue={hotel?.precio != null ? (hotel.precio / 100).toFixed(2) : ''}
        />
        <CampoSelector
          name="criterio"
          etiqueta={t('criterio')}
          defaultValue={hotel?.criterio ?? 'PRIMER_PAGO'}
          opciones={[
            { valor: 'PRIMER_PAGO', etiqueta: t('criterios.PRIMER_PAGO') },
            { valor: 'INSCRIPCION', etiqueta: t('criterios.INSCRIPCION') },
          ]}
        />
      </div>
    </FormularioAccion>
  );
}
