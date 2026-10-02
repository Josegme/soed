import type { CampoAdicional, Idioma } from '@soed/domain';
import { CampoSelector, CampoTexto } from '@soed/ui';
import { getTranslations } from 'next-intl/server';
import { texto } from '@/lib/i18n/traducible';

type Valores = Readonly<Record<string, unknown>>;

/** Entradas de los campos adicionales del evento, nombradas `dato.<codigo>` (OR-16, PR-18). */
export async function EntradasCamposAdicionales({
  definiciones,
  valores,
  idioma,
  defecto,
}: {
  definiciones: readonly CampoAdicional[];
  valores: Valores;
  idioma: Idioma;
  defecto: Idioma;
}) {
  const tc = await getTranslations('comun');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {definiciones.map((c) => {
        const etiqueta = texto(c.etiqueta, idioma, defecto);
        const valor = valores[c.codigo];
        const nombre = `dato.${c.codigo}`;
        if (c.tipo === 'BOOLEANO') {
          return (
            <label key={c.codigo} className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" name={nombre} defaultChecked={valor === true} className="size-5 accent-marca" />
              {etiqueta}
            </label>
          );
        }
        if (c.tipo === 'OPCION') {
          return (
            <CampoSelector
              key={c.codigo}
              name={nombre}
              etiqueta={etiqueta}
              vacio={tc('seleccionar')}
              defaultValue={typeof valor === 'string' ? valor : ''}
              opciones={(c.opciones ?? []).map((o) => ({ valor: o, etiqueta: o }))}
              requerido={c.obligatorio}
              textoRequerido={tc('requerido')}
            />
          );
        }
        return (
          <CampoTexto
            key={c.codigo}
            name={nombre}
            etiqueta={etiqueta}
            type={c.tipo === 'FECHA' ? 'date' : 'text'}
            inputMode={c.tipo === 'NUMERO' ? 'decimal' : undefined}
            defaultValue={valor === undefined || valor === null ? '' : String(valor)}
            requerido={c.obligatorio}
            textoRequerido={tc('requerido')}
            maxLength={500}
          />
        );
      })}
    </div>
  );
}

/** Valores cargados, para mostrar al organizador: «Talle: M · Autoriza foto: Sí». */
export async function ResumenCamposAdicionales({
  definiciones,
  valores,
  idioma,
  defecto,
}: {
  definiciones: readonly CampoAdicional[];
  valores: Valores;
  idioma: Idioma;
  defecto: Idioma;
}) {
  const tc = await getTranslations('comun');
  const partes = definiciones
    .filter((c) => valores[c.codigo] !== undefined && valores[c.codigo] !== '')
    .map((c) => {
      const v = valores[c.codigo];
      return `${texto(c.etiqueta, idioma, defecto)}: ${typeof v === 'boolean' ? (v ? tc('si') : tc('no')) : String(v)}`;
    });
  return partes.length > 0 ? <p className="text-sm text-texto-suave">{partes.join(' · ')}</p> : null;
}
