'use client';

import { Boton } from '@soed/ui';

export function BotonImprimir({ etiqueta }: { etiqueta: string }) {
  return (
    <Boton type="button" onClick={() => window.print()}>
      {etiqueta}
    </Boton>
  );
}
