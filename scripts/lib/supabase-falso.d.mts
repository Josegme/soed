import type { Server } from 'node:http';

export function verificarJwt(token: string, secreto: string): Record<string, unknown> | null;
export function iniciarSupabaseFalso(opciones: { puerto: number; destino: string; secreto: string }): Promise<Server>;
