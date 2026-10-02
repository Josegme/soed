import type { Idioma, ReglamentoEvento } from '@soed/domain';
import { nombreCodigo } from '@/lib/i18n/traducible';

/** Nombre legible de un grupo del ranking ("JUVENIL|SOLO|JAZZ" → "Juvenil · Solista · Jazz"). */
export function etiquetaGrupo(grupo: string, reglamento: ReglamentoEvento | null, idioma: Idioma): string {
  return grupo
    .split('|')
    .map((c) => {
      if (!reglamento) return c;
      for (const tipo of ['categorias', 'formaciones', 'generos'] as const)
        if (reglamento[tipo].some((x) => x.codigo === c)) return nombreCodigo(reglamento, tipo, c, idioma);
      return c;
    })
    .join(' · ');
}
