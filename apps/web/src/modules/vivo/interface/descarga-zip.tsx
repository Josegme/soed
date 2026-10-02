'use client';

import { Boton } from '@soed/ui';
import { useState } from 'react';
import { partesZip, type ArchivoZip } from '@/lib/zip/zip';

export interface ArchivoRemoto {
  nombre: string;
  url: string;
}

/**
 * ZIP de música de un bloque armado en el navegador (OR-49, OP-14): baja cada
 * archivo con su URL firmada y los empaqueta rotulados con el número de orden.
 * El servidor no transfiere los audios, así no hay límite de tamaño de función.
 */
export function DescargaZip({
  archivos,
  nombreZip,
  etiqueta,
  textos,
}: {
  archivos: readonly ArchivoRemoto[];
  nombreZip: string;
  etiqueta: string;
  textos: { preparando: string; listo: string; error: string };
}) {
  const [estado, setEstado] = useState<{ fase: 'inicio' | 'bajando' | 'listo' | 'error'; hechos: number }>({ fase: 'inicio', hechos: 0 });

  async function descargar() {
    setEstado({ fase: 'bajando', hechos: 0 });
    try {
      const bajados: ArchivoZip[] = [];
      for (const [i, a] of archivos.entries()) {
        const r = await fetch(a.url);
        if (!r.ok) throw new Error(String(r.status));
        bajados.push({ nombre: a.nombre, datos: new Uint8Array(await r.arrayBuffer()) });
        setEstado({ fase: 'bajando', hechos: i + 1 });
      }
      const blob = new Blob(partesZip(bajados) as BlobPart[], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = nombreZip;
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setEstado({ fase: 'listo', hechos: archivos.length });
    } catch {
      setEstado((e) => ({ ...e, fase: 'error' }));
    }
  }

  const mensaje =
    estado.fase === 'bajando'
      ? textos.preparando.replace('{hechos}', String(estado.hechos)).replace('{total}', String(archivos.length))
      : estado.fase === 'listo'
        ? textos.listo
        : estado.fase === 'error'
          ? textos.error
          : '';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Boton
        type="button"
        variante="secundario"
        tamano="chico"
        onClick={descargar}
        cargando={estado.fase === 'bajando'}
        disabled={archivos.length === 0}
      >
        {etiqueta}
      </Boton>
      <p
        role={estado.fase === 'error' ? 'alert' : 'status'}
        className={estado.fase === 'error' ? 'text-sm text-error' : 'text-sm text-texto-suave'}
      >
        {mensaje}
      </p>
    </div>
  );
}
