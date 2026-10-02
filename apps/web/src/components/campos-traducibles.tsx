import type { Traducible } from '@soed/domain';
import { CampoArea, CampoTexto } from '@soed/ui';
import { IDIOMAS_SOPORTADOS, NOMBRE_IDIOMA } from '@/lib/i18n/locales';

/**
 * Un campo por idioma soportado para un texto traducible (`<nombre>.<idioma>`).
 * El primero lleva la marca de requerido cuando el traducible lo es: basta un
 * idioma, el resto cae al idioma por defecto del evento (TR-21).
 */
export function CamposTraducibles({
  nombre,
  etiqueta,
  valor,
  requerido = false,
  textoRequerido,
  area = false,
  maxLength,
  ayuda,
  columnas = true,
  className,
}: {
  nombre: string;
  etiqueta: string;
  valor?: Traducible | null;
  requerido?: boolean;
  textoRequerido?: string;
  area?: boolean;
  maxLength?: number;
  ayuda?: string;
  columnas?: boolean;
  className?: string;
}) {
  return (
    <div className={columnas && !area ? 'grid gap-4 sm:grid-cols-2' : 'flex flex-col gap-4'}>
      {IDIOMAS_SOPORTADOS.map((idioma, i) => {
        const props = {
          name: `${nombre}.${idioma}`,
          etiqueta: `${etiqueta} (${NOMBRE_IDIOMA[idioma]})`,
          defaultValue: valor?.[idioma] ?? '',
          requerido: requerido && i === 0,
          textoRequerido,
          maxLength,
          ayuda: i === IDIOMAS_SOPORTADOS.length - 1 ? ayuda : undefined,
          lang: idioma,
          className,
        };
        return area ? <CampoArea key={idioma} {...props} /> : <CampoTexto key={idioma} {...props} />;
      })}
    </div>
  );
}
