'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

/**
 * Cola offline (ADR-0010): las operaciones de jurado, acreditación y caja se
 * guardan primero en IndexedDB y se reenvían a /api/sync. Cada una lleva su
 * client_uuid, así que reenviar nunca duplica. Una operación rechazada por una
 * regla queda visible para que la persona la corrija; nunca se descarta en silencio.
 */
export type TipoOperacion = 'planilla' | 'acreditacion' | 'cobro';

export interface OperacionPendiente {
  id: string;
  tipo: TipoOperacion;
  datos: Record<string, unknown>;
  usuarioId: string;
  creadaAt: string;
  intentos: number;
  estado: 'PENDIENTE' | 'RECHAZADA';
  codigo?: string;
  etiqueta?: string;
}

export interface ResultadoEnvio {
  id: string;
  ok: boolean;
  codigo?: string;
  valor?: unknown;
}

interface EsquemaOffline extends DBSchema {
  outbox: { key: string; value: OperacionPendiente; indexes: { usuario: string } };
}

const EVENTO = 'soed:outbox';
let conexion: Promise<IDBPDatabase<EsquemaOffline>> | null = null;

function abrir() {
  conexion ??= openDB<EsquemaOffline>('soed-offline', 1, {
    upgrade(db) {
      const store = db.createObjectStore('outbox', { keyPath: 'id' });
      store.createIndex('usuario', 'usuarioId');
    },
  });
  return conexion;
}

const avisar = () => window.dispatchEvent(new Event(EVENTO));

export async function encolar(op: Omit<OperacionPendiente, 'creadaAt' | 'intentos' | 'estado'>): Promise<void> {
  await (await abrir()).put('outbox', { ...op, creadaAt: new Date().toISOString(), intentos: 0, estado: 'PENDIENTE' });
  avisar();
}

export async function operaciones(usuarioId: string): Promise<OperacionPendiente[]> {
  const todas = await (await abrir()).getAllFromIndex('outbox', 'usuario', usuarioId);
  return todas.sort((a, b) => a.creadaAt.localeCompare(b.creadaAt));
}

export async function descartar(id: string): Promise<void> {
  await (await abrir()).delete('outbox', id);
  avisar();
}

let enCurso: Promise<ResultadoEnvio[]> | null = null;

/** Reenvía en orden las pendientes del usuario; se detiene ante un error de red para conservar el orden. */
export function sincronizar(usuarioId: string): Promise<ResultadoEnvio[]> {
  enCurso ??= (async () => {
    const resultados: ResultadoEnvio[] = [];
    try {
      const db = await abrir();
      for (const op of await operaciones(usuarioId)) {
        if (op.estado !== 'PENDIENTE') continue;
        let respuesta: Response;
        try {
          respuesta = await fetch('/api/sync', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ tipo: op.tipo, datos: op.datos }),
          });
        } catch {
          break;
        }
        if (respuesta.status === 401 || respuesta.status >= 500) {
          await db.put('outbox', { ...op, intentos: op.intentos + 1 });
          break;
        }
        const cuerpo = (await respuesta.json().catch(() => ({}))) as { ok?: boolean; codigo?: string; valor?: unknown };
        if (respuesta.ok && cuerpo.ok) {
          await db.delete('outbox', op.id);
          resultados.push({ id: op.id, ok: true, valor: cuerpo.valor });
        } else {
          await db.put('outbox', { ...op, intentos: op.intentos + 1, estado: 'RECHAZADA', codigo: cuerpo.codigo ?? 'INESPERADO' });
          resultados.push({ id: op.id, ok: false, codigo: cuerpo.codigo });
        }
      }
    } finally {
      enCurso = null;
      avisar();
    }
    return resultados;
  })();
  return enCurso;
}

export const EVENTO_OUTBOX = EVENTO;
