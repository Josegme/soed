'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

interface DetectorCodigos {
  detect(fuente: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/** ¿El navegador lee QR con la cámara (BarcodeDetector)? Sin él, queda la entrada manual. */
export function lectorQrSoportado(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

/**
 * Lee QR con la cámara trasera mientras `activo` es true y llama a `alLeer`
 * con cada código. Libera la cámara al desactivarse o desmontarse.
 */
export function useLectorQr(activo: boolean, alLeer: (valor: string) => void, alFallar: () => void): RefObject<HTMLVideoElement | null> {
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(alLeer);
  const falla = useRef(alFallar);
  useEffect(() => {
    callback.current = alLeer;
    falla.current = alFallar;
  });
  useEffect(() => {
    if (!activo || !lectorQrSoportado()) return;
    let vigente = true;
    let flujo: MediaStream | null = null;
    const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => DetectorCodigos }).BarcodeDetector;
    const detector = new Detector({ formats: ['qr_code'] });
    void (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!video.current || !vigente) return;
        video.current.srcObject = flujo;
        await video.current.play();
        const leer = async () => {
          if (!vigente || !video.current) return;
          const codigos = await detector.detect(video.current).catch(() => []);
          if (codigos[0]?.rawValue) callback.current(codigos[0].rawValue);
          window.setTimeout(() => void leer(), 400);
        };
        void leer();
      } catch {
        falla.current();
      }
    })();
    return () => {
      vigente = false;
      flujo?.getTracks().forEach((pista) => pista.stop());
    };
  }, [activo]);
  return video;
}

/** Hook auxiliar: soporte calculado una vez en el cliente. */
export function useSoporteLectorQr(): boolean {
  const [soportado] = useState(lectorQrSoportado);
  return soportado;
}
