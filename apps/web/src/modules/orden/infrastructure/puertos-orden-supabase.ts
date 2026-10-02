import 'server-only';
import type { EstadoOrden, FichaParaOrden } from '@soed/domain';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { PuertosOrden } from '../application/orden';

/** Orden de salida con RLS (`orden.editar` / `orden.operar`) y la RPC transaccional de reordenamiento. */
export function puertosOrdenSupabase(db: ClienteSupabase, sesion: Sesion): PuertosOrden {
  return {
    puede: (eventoId, permiso) => tienePermiso(sesion, eventoId, permiso),
    async fichasSinOrden(eventoId) {
      const [{ data }, { data: evento }] = await Promise.all([
        db
          .from('ficha')
          .select('id, academia_id, categoria, formacion, genero, orden_item (id)')
          .eq('evento_id', eventoId)
          .in('estado', ['ENVIADA', 'APROBADA']),
        db.from('evento').select('reglamento').eq('id', eventoId).single(),
      ]);
      // El orden de las categorías lo define el reglamento (las menores salen primero).
      const categorias = ((evento?.reglamento as { categorias?: { codigo: string }[] } | null)?.categorias ?? []).map((c) => c.codigo);
      const ordenCategoria = (c: string | null) => (c && categorias.includes(c) ? categorias.indexOf(c) : categorias.length);
      return (data ?? [])
        .filter((f) => f.orden_item.length === 0)
        .map(
          (f): FichaParaOrden => ({
            fichaId: f.id,
            academia: f.academia_id,
            categoriaOrden: ordenCategoria(f.categoria),
            formacion: f.formacion,
            genero: f.genero,
          }),
        );
    },
    async ordenFormaciones(eventoId) {
      const { data } = await db.from('evento').select('reglamento').eq('id', eventoId).maybeSingle();
      const formaciones = (data?.reglamento as { formaciones?: { codigo: string }[] } | null)?.formaciones ?? [];
      return formaciones.map((f) => f.codigo);
    },
    async ultimaPosicion(bloqueId) {
      const { data } = await db.from('orden_item').select('posicion').eq('bloque_id', bloqueId).order('posicion', { ascending: false }).limit(1).maybeSingle();
      return data?.posicion ?? 0;
    },
    async bloque(bloqueId) {
      const { data } = await db.from('bloque').select('id, evento_id, pista_id').eq('id', bloqueId).maybeSingle();
      return data ? { id: data.id, eventoId: data.evento_id, pistaId: data.pista_id } : null;
    },
    async insertarItems(items) {
      const { error } = await db.from('orden_item').insert(
        items.map((i) => ({ evento_id: i.eventoId, pista_id: i.pistaId, bloque_id: i.bloqueId, ficha_id: i.fichaId, posicion: i.posicion })),
      );
      if (error) throw new Error(error.message);
    },
    async item(itemId) {
      const { data } = await db.from('orden_item').select('id, evento_id, estado').eq('id', itemId).maybeSingle();
      return data ? { id: data.id, eventoId: data.evento_id, estado: data.estado as EstadoOrden } : null;
    },
    async actualizarEstado(itemId, estado) {
      const { error } = await db
        .from('orden_item')
        .update({ estado, actualizado_por: sesion.usuarioId, actualizado_at: new Date().toISOString() })
        .eq('id', itemId);
      if (error) throw new Error(error.message);
    },
    async liberarEscena(itemId) {
      const { data: item } = await db.from('orden_item').select('pista_id').eq('id', itemId).single();
      if (!item) return;
      // La que estaba en escena pasa a presentada: el índice único parcial impide dos a la vez.
      const { error } = await db
        .from('orden_item')
        .update({ estado: 'PRESENTADA', actualizado_por: sesion.usuarioId, actualizado_at: new Date().toISOString() })
        .eq('pista_id', item.pista_id)
        .eq('estado', 'EN_ESCENA')
        .neq('id', itemId);
      if (error) throw new Error(error.message);
    },
  };
}
