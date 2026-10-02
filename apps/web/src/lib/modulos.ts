import 'server-only';
import { habilitadoPorModulos, moduloActivo, type Modulo } from '@soed/shared-types';
import { notFound } from 'next/navigation';
import { cliente } from '@/cliente';

/**
 * Módulos de la instancia (TR-39, ADR-0003): un módulo apagado en
 * client.config no aparece en la navegación, sus rutas responden 404 y sus
 * acciones se rechazan. Nunca `if (cliente === 'x')`: siempre por módulo.
 */
export const moduloOn = (modulo: Modulo): boolean => moduloActivo(cliente, modulo);

/** Alguno de los módulos indicados activo; si no, 404. */
export function exigirModulo(...modulos: Modulo[]): void {
  if (!habilitadoPorModulos(cliente, modulos)) notFound();
}

export const habilitado = (modulos: readonly Modulo[]): boolean => habilitadoPorModulos(cliente, modulos);
