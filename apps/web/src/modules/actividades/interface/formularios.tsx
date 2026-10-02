import { CampoTexto } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { CamposTraducibles } from '@/components/campos-traducibles';
import { FormularioAccion } from '@/components/formulario-accion';
import { localDesdeInstante } from '@/lib/fechas-zona';
import type { Clase, EntradaTipo } from '../infrastructure/consultas';
import { guardarClaseAccion, guardarEntradaAccion } from './acciones';

const decimal = (centavos: number | undefined) => (centavos === undefined ? '' : (centavos / 100).toFixed(2));

function Publicada({ etiqueta, marcada }: { etiqueta: string; marcada: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input type="checkbox" name="publicada" defaultChecked={marcada} className="size-5 accent-marca" />
      {etiqueta}
    </label>
  );
}

/** Alta o edición de una clase (OR-51). Los horarios se cargan en la hora de la sede. */
export async function FormularioClase({
  eventoId,
  zona,
  moneda,
  clase,
}: {
  eventoId: string;
  zona: string;
  moneda: string;
  clase?: Clase;
}) {
  const t = await getTranslations('gestion.actividades');
  const tc = await getTranslations('comun');
  return (
    <FormularioAccion
      accion={guardarClaseAccion}
      namespace="gestion.actividades"
      boton={clase ? tc('guardar') : tc('crear')}
      tamano="chico"
      className="mt-3 max-w-2xl"
    >
      <input type="hidden" name="eventoId" value={eventoId} />
      {clase ? <input type="hidden" name="claseId" value={clase.id} /> : null}
      <CamposTraducibles
        nombre="nombre"
        etiqueta={tc('nombre')}
        valor={clase?.nombre}
        requerido
        textoRequerido={tc('requerido')}
        maxLength={160}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <CampoTexto name="docente" etiqueta={t('docente')} defaultValue={clase?.docente ?? ''} maxLength={200} />
        <CampoTexto name="sala" etiqueta={t('sala')} defaultValue={clase?.sala ?? ''} maxLength={120} />
        <CampoTexto
          name="inicio"
          type="datetime-local"
          etiqueta={t('inicio')}
          ayuda={t('zonaHoraria', { zona })}
          defaultValue={clase ? localDesdeInstante(clase.inicio, zona) : ''}
          requerido
          textoRequerido={tc('requerido')}
        />
        <CampoTexto
          name="fin"
          type="datetime-local"
          etiqueta={t('fin')}
          defaultValue={clase ? localDesdeInstante(clase.fin, zona) : ''}
          requerido
          textoRequerido={tc('requerido')}
        />
        <CampoTexto
          name="cupo"
          type="number"
          min={0}
          etiqueta={t('cupo')}
          defaultValue={clase ? String(clase.cupo) : ''}
          requerido
          textoRequerido={tc('requerido')}
        />
        <CampoTexto name="precio" inputMode="decimal" etiqueta={t('precio', { moneda })} defaultValue={decimal(clase?.precio)} />
      </div>
      <Publicada etiqueta={t('publicar')} marcada={clase?.publicada ?? false} />
    </FormularioAccion>
  );
}

/** Alta o edición de un tipo de entrada (OR-52). */
export async function FormularioEntrada({ eventoId, moneda, entrada }: { eventoId: string; moneda: string; entrada?: EntradaTipo }) {
  const t = await getTranslations('gestion.actividades');
  const tc = await getTranslations('comun');
  return (
    <FormularioAccion
      accion={guardarEntradaAccion}
      namespace="gestion.actividades"
      boton={entrada ? tc('guardar') : tc('crear')}
      tamano="chico"
      className="mt-3 max-w-2xl"
    >
      <input type="hidden" name="eventoId" value={eventoId} />
      {entrada ? <input type="hidden" name="entradaId" value={entrada.id} /> : null}
      <CamposTraducibles
        nombre="nombre"
        etiqueta={tc('nombre')}
        valor={entrada?.nombre}
        requerido
        textoRequerido={tc('requerido')}
        maxLength={160}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <CampoTexto name="fecha" type="date" etiqueta={t('fecha')} ayuda={t('fechaAyuda')} defaultValue={entrada?.fecha ?? ''} />
        <CampoTexto
          name="cupo"
          type="number"
          min={0}
          etiqueta={t('cupo')}
          defaultValue={entrada ? String(entrada.cupo) : ''}
          requerido
          textoRequerido={tc('requerido')}
        />
        <CampoTexto name="precio" inputMode="decimal" etiqueta={t('precio', { moneda })} defaultValue={decimal(entrada?.precio)} />
      </div>
      <Publicada etiqueta={t('publicar')} marcada={entrada?.publicada ?? false} />
    </FormularioAccion>
  );
}
