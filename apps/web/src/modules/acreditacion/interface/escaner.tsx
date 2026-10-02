'use client';

import { Boton } from '@soed/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, useTransition } from 'react';
import { libre } from '@/lib/i18n/claves';
import { formatearInstante } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { encolar, sincronizar } from '@/lib/offline/outbox';
import { useLectorQr, useSoporteLectorQr } from '@/lib/qr/use-lector-qr';

interface Lectura {
  tono: 'exito' | 'alerta' | 'error' | 'info';
  titulo: string;
  detalle?: string;
}

const TOKEN = /^[0-9a-f]{32}$/;
const extraerToken = (valor: string) => {
  const limpio = valor.trim().toLowerCase();
  // El QR lleva solo el token; se acepta también una URL que termine en él.
  return TOKEN.test(limpio) ? limpio : (/([0-9a-f]{32})$/.exec(limpio)?.[1] ?? null);
};

/**
 * Acreditación por QR (OP-16, OP-17): cámara con BarcodeDetector cuando el
 * navegador lo soporta y entrada manual del token siempre. Cada lectura va a la
 * cola offline con su client_uuid; la deuda nunca se consulta (TR-12).
 */
export function EscanerAcreditacion({
  usuarioId,
  zonaHoraria,
  tokenInicial,
}: {
  usuarioId: string;
  zonaHoraria: string;
  tokenInicial?: string;
}) {
  const t = useTranslations('acreditacion.escaner');
  const tt = libre(useTranslations('acreditacion.tipos'));
  const te = libre(useTranslations('errores'));
  const idioma = idiomaDe(useLocale());
  const router = useRouter();
  const id = useId();
  const [camara, setCamara] = useState(false);
  const soportada = useSoporteLectorQr();
  const [lectura, setLectura] = useState<Lectura | null>(null);
  const [token, setToken] = useState(tokenInicial ?? '');
  const [pendiente, iniciar] = useTransition();
  const ultimo = useRef<{ token: string; at: number } | null>(null);

  const acreditar = (valor: string) => {
    const qrToken = extraerToken(valor);
    if (!qrToken) {
      setLectura({ tono: 'error', titulo: te('QR_INVALIDO') });
      return;
    }
    // Una misma credencial frente a la cámara no se procesa dos veces seguidas.
    if (ultimo.current && ultimo.current.token === qrToken && Date.now() - ultimo.current.at < 4000) return;
    ultimo.current = { token: qrToken, at: Date.now() };
    iniciar(async () => {
      const clientUuid = crypto.randomUUID();
      await encolar({
        id: clientUuid,
        tipo: 'acreditacion',
        usuarioId,
        etiqueta: qrToken.slice(0, 8),
        datos: { qrToken, clientUuid, dispositivoAt: new Date().toISOString() },
      });
      const r = (await sincronizar(usuarioId)).find((x) => x.id === clientUuid);
      if (!r) {
        setLectura({ tono: 'info', titulo: t('guardadaLocal') });
        return;
      }
      if (!r.ok) {
        setLectura({ tono: 'error', titulo: r.codigo && te.has(r.codigo) ? te(r.codigo) : te('INESPERADO') });
        return;
      }
      const v = r.valor as {
        resultado: 'ACREDITADO' | 'YA_ACREDITADO';
        at: string;
        credencial: { nombre: string; tipo: string; academia: string | null };
      };
      const detalle = [tt.has(v.credencial.tipo) ? tt(v.credencial.tipo) : v.credencial.tipo, v.credencial.academia]
        .filter(Boolean)
        .join(' · ');
      setLectura(
        v.resultado === 'ACREDITADO'
          ? { tono: 'exito', titulo: t('acreditado', { nombre: v.credencial.nombre }), detalle }
          : {
              tono: 'alerta',
              titulo: t('yaAcreditado', {
                nombre: v.credencial.nombre,
                hora: formatearInstante(v.at, idioma, zonaHoraria, { timeStyle: 'short' }),
              }),
              detalle,
            },
      );
      setToken('');
      router.refresh();
    });
  };

  const video = useLectorQr(camara, acreditar, () => {
    setLectura({ tono: 'error', titulo: t('sinCamara') });
    setCamara(false);
  });

  const colores: Record<Lectura['tono'], string> = {
    exito: 'border-exito bg-exito/10',
    alerta: 'border-alerta bg-alerta/10',
    error: 'border-error bg-error/10',
    info: 'border-info bg-info/10',
  };

  return (
    <div className="flex flex-col gap-4">
      {soportada ? (
        <div className="flex flex-col gap-3">
          <Boton type="button" variante={camara ? 'secundario' : 'primario'} tamano="grande" onClick={() => setCamara((c) => !c)}>
            {camara ? t('detenerCamara') : t('usarCamara')}
          </Boton>
          {camara ? (
            <video
              ref={video}
              muted
              playsInline
              aria-label={t('vistaCamara')}
              className="aspect-video w-full rounded-[var(--radio)] bg-black object-cover"
            />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-texto-suave">{t('sinDetector')}</p>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          acreditar(token);
        }}
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor={id} className="text-sm font-medium">
            {t('token')}
          </label>
          <input
            id={id}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            inputMode="text"
            className="min-h-12 rounded-[var(--radio)] border border-borde bg-superficie px-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-marca/60"
          />
        </div>
        <Boton type="submit" tamano="grande" cargando={pendiente}>
          {t('acreditar')}
        </Boton>
      </form>
      <div aria-live="assertive" aria-atomic="true">
        {lectura ? (
          <div className={`flex flex-col gap-1 rounded-[var(--radio)] border-2 p-5 ${colores[lectura.tono]}`}>
            <p className="font-display text-2xl font-bold">{lectura.titulo}</p>
            {lectura.detalle ? <p className="text-sm">{lectura.detalle}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Acreditación manual desde la lista (sin QR a mano): misma cola y mismas reglas que el escaneo. */
export function BotonAcreditar({ usuarioId, qrToken, nombre }: { usuarioId: string; qrToken: string; nombre: string }) {
  const t = useTranslations('acreditacion.escaner');
  const te = libre(useTranslations('errores'));
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Boton
        type="button"
        tamano="chico"
        variante="secundario"
        cargando={pendiente}
        aria-label={t('acreditarA', { nombre })}
        onClick={() =>
          iniciar(async () => {
            const clientUuid = crypto.randomUUID();
            await encolar({
              id: clientUuid,
              tipo: 'acreditacion',
              usuarioId,
              etiqueta: nombre,
              datos: { qrToken, clientUuid, dispositivoAt: new Date().toISOString() },
            });
            const r = (await sincronizar(usuarioId)).find((x) => x.id === clientUuid);
            if (!r) setMensaje(t('guardadaLocal'));
            else if (r.ok) router.refresh();
            else setMensaje(r.codigo && te.has(r.codigo) ? te(r.codigo) : te('INESPERADO'));
          })
        }
      >
        {t('acreditar')}
      </Boton>
      {mensaje ? (
        <span role="status" className="text-xs text-texto-suave">
          {mensaje}
        </span>
      ) : null}
    </span>
  );
}
