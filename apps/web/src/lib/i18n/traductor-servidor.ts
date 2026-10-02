import 'server-only';
import type { Idioma } from '@soed/domain';
import { createTranslator, type Messages } from 'next-intl';
import { libre, type TraductorLibre } from './claves';

/**
 * Traductor fuera del ciclo de un request (crons, colas, emails): carga el
 * catálogo del idioma igual que i18n/request.ts, así un idioma nuevo no
 * requiere cambios aquí (ADR-0005).
 */
export async function traductorServidor(idioma: Idioma, namespace: string): Promise<TraductorLibre> {
  const messages = (await import(`../../../messages/${idioma}.json`)).default as Messages;
  return libre(createTranslator({ locale: idioma, messages, namespace: namespace as never }));
}
