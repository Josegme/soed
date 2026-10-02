'use client';

import type { Idioma, Infraccion, ReglamentoEvento } from '@soed/domain';
import { Aviso, Boton, CampoArea, CampoSelector, Insignia } from '@soed/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState, useState, useTransition } from 'react';
import { ESTADO_INICIAL } from '@/lib/formularios';
import { texto } from '@/lib/i18n/traducible';
import {
  emitirLiquidacionAccion,
  enviarFichaAccion,
  guardarRubros,
  inscribirAcademia,
  inscribirFicha,
  retirarFicha,
  revalidarFichaAccion,
  solicitarModificacion,
} from './acciones';
import { useMensaje } from './formularios';

type Respuesta = { ok: boolean; mensaje?: string; numero?: string; version?: number };

/** Botón que llama a una server action y anuncia el resultado (role=status/alert). */
function useAccion(namespace: string) {
  const t = useTranslations(namespace);
  const te = useTranslations('errores');
  const [pendiente, iniciar] = useTransition();
  const [resultado, setResultado] = useState<{ ok: boolean; texto: string } | null>(null);
  const ejecutar = (fn: () => Promise<Respuesta>, valores?: Record<string, string | number>) =>
    iniciar(async () => {
      const r = await fn();
      const clave = r.mensaje ?? (r.ok ? '' : 'INESPERADO');
      const textoResultado = !clave ? '' : t.has(clave) ? t(clave, { ...valores, numero: r.numero ?? '', version: r.version ?? '' }) : te.has(clave) ? te(clave) : te('INESPERADO');
      setResultado(textoResultado ? { ok: r.ok, texto: textoResultado } : null);
    });
  return { pendiente, resultado, ejecutar };
}

export function BotonInscribirAcademia({ eventoId, academiaId }: { eventoId: string; academiaId: string }) {
  const t = useTranslations('academia.inscripcion');
  const { pendiente, resultado, ejecutar } = useAccion('academia.inscripcion');
  return (
    <div className="flex flex-col gap-3">
      {resultado && !resultado.ok ? <Aviso tono="error">{resultado.texto}</Aviso> : null}
      <Boton cargando={pendiente} onClick={() => ejecutar(() => inscribirAcademia(eventoId, academiaId))}>
        {t('inscribirAcademia')}
      </Boton>
    </div>
  );
}

export function FormularioFicha({
  eventoId,
  academiaId,
  coreografias,
  reglamento,
}: {
  eventoId: string;
  academiaId: string;
  coreografias: { id: string; nombre: string; formacion: string }[];
  reglamento: ReglamentoEvento;
}) {
  const t = useTranslations('academia.inscripcion');
  const idioma = useLocale() as Idioma;
  const m = useMensaje('academia.inscripcion');
  const [estado, accion, pendiente] = useActionState(inscribirFicha, ESTADO_INICIAL);
  const [elegida, setElegida] = useState('');
  const formacion = reglamento.formaciones.find((f) => f.codigo === coreografias.find((c) => c.id === elegida)?.formacion);
  const esGrupo = formacion?.criterioCategoria === 'TOLERANCIA_GRUPO';
  const mensaje = estado.ok ? null : m.general(estado);
  if (coreografias.length === 0) return <Aviso tono="info">{t('sinCoreografiasDisponibles')}</Aviso>;
  return (
    <form action={accion} className="flex flex-col gap-4 sm:flex-row sm:items-end" noValidate>
      {mensaje ? <Aviso tono="error">{mensaje}</Aviso> : null}
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="academiaId" value={academiaId} />
      <div className="flex-1">
        <CampoSelector
          name="coreografiaId"
          etiqueta={t('coreografia')}
          vacio="—"
          value={elegida}
          onChange={(e) => setElegida(e.target.value)}
          opciones={coreografias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
        />
      </div>
      {esGrupo ? (
        <div className="flex-1">
          <CampoSelector
            name="categoriaDeclarada"
            etiqueta={t('categoriaDeclarada')}
            ayuda={t('categoriaAyuda')}
            vacio={t('categoriaAuto')}
            opciones={reglamento.categorias.map((c) => ({ valor: c.codigo, etiqueta: texto(c.nombre, idioma) || c.codigo }))}
          />
        </div>
      ) : null}
      <Boton type="submit" cargando={pendiente} disabled={!elegida}>
        {t('agregarFicha')}
      </Boton>
    </form>
  );
}

export function ListaInfracciones({ infracciones, tono }: { infracciones: readonly Infraccion[]; tono: 'error' | 'alerta' }) {
  const t = useTranslations('reglamento.infraccion');
  if (infracciones.length === 0) return null;
  return (
    <ul className={`flex list-disc flex-col gap-1 pl-5 text-sm ${tono === 'error' ? 'text-error' : 'text-alerta'}`}>
      {infracciones.map((i, n) => (
        <li key={`${i.codigo}-${n}`}>{t(i.codigo, i.params ?? {})}</li>
      ))}
    </ul>
  );
}

export function AccionesFicha({ fichaId, estado, modificable }: { fichaId: string; estado: string; modificable: boolean }) {
  const t = useTranslations('academia.inscripcion');
  const { pendiente, resultado, ejecutar } = useAccion('academia.inscripcion');
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {modificable && (estado === 'BORRADOR' || estado === 'OBSERVADA') ? (
          <Boton tamano="chico" cargando={pendiente} onClick={() => ejecutar(() => enviarFichaAccion(fichaId))}>
            {t('enviar')}
          </Boton>
        ) : null}
        {estado !== 'RETIRADA' ? (
          <Boton tamano="chico" variante="secundario" cargando={pendiente} onClick={() => ejecutar(() => revalidarFichaAccion(fichaId))}>
            {t('revalidar')}
          </Boton>
        ) : null}
        {modificable && estado !== 'RETIRADA' ? (
          <Boton tamano="chico" variante="fantasma" cargando={pendiente} onClick={() => ejecutar(() => retirarFicha(fichaId))}>
            {t('retirar')}
          </Boton>
        ) : null}
      </div>
      {resultado ? (
        <p role={resultado.ok ? 'status' : 'alert'} className={`text-sm ${resultado.ok ? 'text-exito' : 'text-error'}`}>
          {resultado.texto}
        </p>
      ) : null}
    </div>
  );
}

export function FormularioSolicitud({ fichaId }: { fichaId: string }) {
  const t = useTranslations('academia.inscripcion');
  const tc = useTranslations('comun');
  const m = useMensaje('academia.inscripcion');
  const [estado, accion, pendiente] = useActionState(solicitarModificacion, ESTADO_INICIAL);
  const mensaje = m.general(estado);
  return (
    <details className="text-sm">
      <summary className="cursor-pointer font-semibold text-marca">{t('solicitarModificacion')}</summary>
      <form action={accion} className="mt-3 flex flex-col gap-3" noValidate>
        {mensaje ? <Aviso tono={estado.ok ? 'exito' : 'error'}>{mensaje}</Aviso> : null}
        <input type="hidden" name="fichaId" value={fichaId} />
        <CampoArea name="descripcion" etiqueta={t('descripcionSolicitud')} requerido textoRequerido={tc('requerido')} error={m.campo(estado, 'descripcion')} />
        <div>
          <Boton type="submit" tamano="chico" cargando={pendiente}>
            {tc('enviar')}
          </Boton>
        </div>
      </form>
    </details>
  );
}

export function EmitirLiquidacion({ inscripcionId }: { inscripcionId: string }) {
  const t = useTranslations('academia.inscripcion');
  const { pendiente, resultado, ejecutar } = useAccion('academia.inscripcion');
  return (
    <div className="flex flex-col gap-2">
      <Boton cargando={pendiente} onClick={() => ejecutar(() => emitirLiquidacionAccion(inscripcionId))}>
        {t('emitir')}
      </Boton>
      {resultado ? (
        <p role={resultado.ok ? 'status' : 'alert'} className={`text-sm ${resultado.ok ? 'text-exito' : 'text-error'}`}>
          {resultado.texto}
        </p>
      ) : null}
    </div>
  );
}

export function FormularioRubros({
  inscripcionId,
  rubros,
  seleccion,
}: {
  inscripcionId: string;
  rubros: { codigo: string; nombre: string; precio: string }[];
  seleccion: Record<string, number>;
}) {
  const t = useTranslations('academia.inscripcion');
  const { pendiente, resultado, ejecutar } = useAccion('academia.inscripcion');
  const [cantidades, setCantidades] = useState<Record<string, number>>(seleccion);
  if (rubros.length === 0) return null;
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="font-semibold">{t('rubros')}</legend>
      {rubros.map((r) => (
        <label key={r.codigo} className="flex items-center justify-between gap-3 text-sm">
          <span>
            {r.nombre} <span className="text-texto-suave">· {r.precio}</span>
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            inputMode="numeric"
            aria-label={`${t('cantidad')}: ${r.nombre}`}
            value={cantidades[r.codigo] ?? 0}
            onChange={(e) => setCantidades({ ...cantidades, [r.codigo]: Math.max(0, Number(e.target.value) || 0) })}
            className="min-h-11 w-20 rounded-[var(--radio)] border border-borde bg-superficie px-2 text-right"
          />
        </label>
      ))}
      <div>
        <Boton
          tamano="chico"
          variante="secundario"
          cargando={pendiente}
          onClick={() => ejecutar(() => guardarRubros({ inscripcionId, rubros: Object.entries(cantidades).map(([codigo, cantidad]) => ({ codigo, cantidad })) }))}
        >
          {t('guardarRubros')}
        </Boton>
      </div>
      {resultado ? (
        <p role={resultado.ok ? 'status' : 'alert'} className="text-sm">
          {resultado.texto}
        </p>
      ) : null}
    </fieldset>
  );
}

export function InsigniaEstadoFicha({ estado }: { estado: string }) {
  const t = useTranslations('estados.ficha');
  const tono = estado === 'APROBADA' ? 'exito' : estado === 'ENVIADA' ? 'info' : estado === 'OBSERVADA' ? 'alerta' : 'neutro';
  return <Insignia tono={tono}>{t(estado as 'BORRADOR')}</Insignia>;
}
