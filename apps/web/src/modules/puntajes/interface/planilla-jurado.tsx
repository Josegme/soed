'use client';

import { totalPlanilla, type ConfigPuntaje } from '@soed/domain';
import { Aviso, Boton, CampoArea } from '@soed/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useState, useTransition } from 'react';
import { libre } from '@/lib/i18n/claves';
import { formatearPuntaje } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { encolar, sincronizar } from '@/lib/offline/outbox';

export interface CriterioPlanilla {
  id: string;
  codigo: string;
  nombre: string;
  peso: number;
}

export interface PlanillaExistente {
  estado: 'BORRADOR' | 'ENVIADA' | 'REABIERTA';
  notas: Record<string, number>;
  comentario: string | null;
  total: number | null;
  motivoReapertura: string | null;
}

type Aviso_ = { tono: 'exito' | 'error' | 'info'; texto: string } | null;

/**
 * Planilla del jurado (JU-03 a JU-06). Offline-first: cada guardado entra a la
 * cola local y se envía en cuanto hay conexión (ADR-0010). El total se calcula
 * en vivo con la misma función del dominio que usa el servidor.
 */
export function PlanillaJurado({
  usuarioId,
  fichaId,
  fichaNombre,
  criterios,
  puntaje,
  existente,
}: {
  usuarioId: string;
  fichaId: string;
  fichaNombre: string;
  criterios: readonly CriterioPlanilla[];
  puntaje: ConfigPuntaje;
  existente: PlanillaExistente | null;
}) {
  const t = useTranslations('jurado.planilla');
  const te = libre(useTranslations('errores'));
  const idioma = idiomaDe(useLocale());
  const router = useRouter();
  const id = useId();
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(criterios.map((c) => [c.id, existente?.notas[c.id] !== undefined ? String(existente.notas[c.id]) : ''])),
  );
  const [comentario, setComentario] = useState(existente?.comentario ?? '');
  const [confirmando, setConfirmando] = useState(false);
  const [aviso, setAviso] = useState<Aviso_>(null);
  const [pendiente, iniciar] = useTransition();
  const paso = 1 / 10 ** puntaje.decimalesNota;

  const notas = criterios
    .filter((c) => valores[c.id]?.trim())
    .map((c) => ({ criterioId: c.id, codigo: c.codigo, valor: Number(valores[c.id]!.replace(',', '.')) }));
  const total = totalPlanilla(
    notas.map((n) => ({ criterio: n.codigo, valor: n.valor })),
    criterios.map((c) => ({ codigo: c.codigo, peso: c.peso })),
    puntaje,
  );

  if (existente?.estado === 'ENVIADA') {
    return (
      <Aviso tono="exito" titulo={t('enviada')}>
        {existente.total !== null
          ? t('totalEnviado', { total: formatearPuntaje(existente.total, idioma, puntaje.decimalesResultado) })
          : null}
      </Aviso>
    );
  }

  const guardar = (enviar: boolean) =>
    iniciar(async () => {
      const clientUuid = crypto.randomUUID();
      await encolar({
        id: clientUuid,
        tipo: 'planilla',
        usuarioId,
        etiqueta: fichaNombre,
        datos: {
          fichaId,
          notas: notas.map(({ criterioId, valor }) => ({ criterioId, valor })),
          comentario: comentario.trim() || undefined,
          enviar,
          clientUuid,
        },
      });
      const resultado = (await sincronizar(usuarioId)).find((r) => r.id === clientUuid);
      setConfirmando(false);
      if (!resultado) setAviso({ tono: 'info', texto: t('guardadaLocal') });
      else if (resultado.ok) {
        setAviso({ tono: 'exito', texto: enviar ? t('enviadaOk') : t('borradorOk') });
        router.refresh();
      } else setAviso({ tono: 'error', texto: resultado.codigo && te.has(resultado.codigo) ? te(resultado.codigo) : te('INESPERADO') });
    });

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
      }}
      noValidate
    >
      {existente?.estado === 'REABIERTA' ? (
        <Aviso tono="alerta">{t('reabierta', { motivo: existente.motivoReapertura ?? '' })}</Aviso>
      ) : null}
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">{t('notas')}</legend>
        {criterios.map((c) => {
          const campo = `${id}-${c.id}`;
          return (
            <div key={c.id} className="flex flex-col gap-1.5">
              <label htmlFor={campo} className="flex items-baseline justify-between text-sm font-medium">
                <span>{c.nombre}</span>
                <span className="text-xs text-texto-suave">{t('peso', { peso: c.peso })}</span>
              </label>
              <input
                id={campo}
                type="number"
                inputMode="decimal"
                min={puntaje.escalaMin}
                max={puntaje.escalaMax}
                step={paso}
                value={valores[c.id] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [c.id]: e.target.value }))}
                aria-describedby={`${id}-escala`}
                className="min-h-14 rounded-[var(--radio)] border border-borde bg-superficie px-4 text-center font-display text-2xl font-bold tabular-nums focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-marca/60"
              />
            </div>
          );
        })}
      </fieldset>
      <p id={`${id}-escala`} className="text-xs text-texto-suave">
        {t('escala', { min: puntaje.escalaMin, max: puntaje.escalaMax, decimales: puntaje.decimalesNota })}
      </p>
      <CampoArea
        etiqueta={t('comentario')}
        ayuda={t('ayudaComentario')}
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        maxLength={4000}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radio)] bg-superficie-2 px-4 py-3">
        <span className="text-sm">{t('total')}</span>
        <output className="font-display text-3xl font-bold tabular-nums" aria-live="polite">
          {total.ok ? formatearPuntaje(total.value, idioma, puntaje.decimalesResultado) : '—'}
        </output>
      </div>
      {!total.ok && notas.length > 0 ? (
        <p className="text-sm text-error" role="alert">
          {te.has(total.error.codigo) ? te(total.error.codigo) : t('incompleta')}
        </p>
      ) : null}
      {aviso ? <Aviso tono={aviso.tono}>{aviso.texto}</Aviso> : null}
      <div className="flex flex-wrap gap-3">
        <Boton type="submit" variante="secundario" cargando={pendiente}>
          {t('guardarBorrador')}
        </Boton>
        {confirmando ? (
          <>
            <Boton type="button" variante="acento" cargando={pendiente} onClick={() => guardar(true)}>
              {t('confirmarEnvio')}
            </Boton>
            <Boton type="button" variante="fantasma" onClick={() => setConfirmando(false)}>
              {t('cancelar')}
            </Boton>
          </>
        ) : (
          <Boton type="button" disabled={!total.ok} onClick={() => setConfirmando(true)}>
            {t('enviar')}
          </Boton>
        )}
      </div>
      {confirmando ? <p className="text-sm text-texto-suave">{t('avisoEnvio')}</p> : null}
    </form>
  );
}
