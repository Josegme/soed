'use client';

import { Boton } from '@soed/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useLectorQr, useSoporteLectorQr } from '@/lib/qr/use-lector-qr';

/** Escanea un QR y lo usa como búsqueda (?q=): liquidaciones en la mesa de cobros (OR-32, OP-19). */
export function BuscadorQr() {
  const t = useTranslations('caja');
  const router = useRouter();
  const ruta = usePathname();
  const soportado = useSoporteLectorQr();
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState(false);
  const video = useLectorQr(
    activo,
    (valor) => {
      setActivo(false);
      router.push(`${ruta}?q=${encodeURIComponent(valor.trim().toLowerCase().slice(-32))}`);
    },
    () => {
      setError(true);
      setActivo(false);
    },
  );
  if (!soportado) return null;
  return (
    <div className="flex flex-col gap-2">
      <Boton type="button" variante="secundario" onClick={() => setActivo((a) => !a)}>
        {activo ? t('detenerQr') : t('escanearQr')}
      </Boton>
      {activo ? (
        <video
          ref={video}
          muted
          playsInline
          aria-label={t('vistaCamara')}
          className="aspect-video w-full max-w-md rounded-[var(--radio)] bg-black object-cover"
        />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-error">
          {t('sinCamara')}
        </p>
      ) : null}
    </div>
  );
}
