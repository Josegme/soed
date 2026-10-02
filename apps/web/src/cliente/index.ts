import { configClienteSchema, type ConfigCliente } from '@soed/shared-types';
import { z } from 'zod';
import crudo, { SLUG_CLIENTE } from './generado/config';

/**
 * Configuración de la instancia validada (ADR-0003). Si client.config.ts está
 * incompleto, el build falla aquí con el detalle del error.
 */
function cargar(): ConfigCliente {
  const r = configClienteSchema.safeParse(crudo);
  if (!r.success) {
    throw new Error(`clients/${SLUG_CLIENTE}/client.config.ts inválido:\n${z.prettifyError(r.error)}`);
  }
  return r.data;
}

export const cliente: ConfigCliente = cargar();
export { SLUG_CLIENTE };
