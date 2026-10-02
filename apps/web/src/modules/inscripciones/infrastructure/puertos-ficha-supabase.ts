import 'server-only';
import type { FechaISO, ReglamentoEvento } from '@soed/domain';
import type { Json } from '@soed/shared-types/database';
import { tienePermiso, type Sesion } from '@/lib/auth/permisos';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { ClienteSupabase } from '@/lib/supabase/server';
import type { FichaParaValidar, PuertosFicha } from '../application/fichas';

/**
 * Lecturas con el cliente del usuario (RLS decide qué puede ver). Las columnas
 * derivadas las escribe el servidor con service_role solo después de que
 * `puedeEditar` confirmó el permiso (ADR-0006).
 */
export function puertosFichaSupabase(db: ClienteSupabase, sesion: Sesion): PuertosFicha {
  return {
    async leerFicha(id) {
      const { data } = await db
        .from('ficha')
        .select('id, evento_id, academia_id, estado, bloqueada, genero, formacion, categoria_declarada, musica_duracion_seg, excepcion, ficha_bailarin (bailarin_id)')
        .eq('id', id)
        .maybeSingle();
      if (!data) return null;
      const ids = data.ficha_bailarin.map((x) => x.bailarin_id);
      const { data: bailarines } = ids.length
        ? await db.from('bailarin').select('id, fecha_nacimiento').in('id', ids)
        : { data: [] as { id: string; fecha_nacimiento: string }[] };
      return {
        id: data.id,
        eventoId: data.evento_id,
        academiaId: data.academia_id,
        estado: data.estado as FichaParaValidar['estado'],
        bloqueada: data.bloqueada,
        genero: data.genero,
        formacion: data.formacion,
        categoriaDeclarada: data.categoria_declarada,
        duracionMusicaSegundos: data.musica_duracion_seg,
        tieneExcepcion: data.excepcion !== null,
        integrantes: (bailarines ?? []).map((b) => ({ bailarinId: b.id, fechaNacimiento: b.fecha_nacimiento as FechaISO })),
      };
    },
    async leerEvento(id) {
      const { data } = await db
        .from('evento')
        .select('id, reglamento, reglamento_version, fecha_inicio, fecha_fin, inscripcion_apertura, inscripcion_cierre, modificaciones_cierre')
        .eq('id', id)
        .maybeSingle();
      if (!data) return null;
      return {
        id: data.id,
        reglamento: data.reglamento as unknown as ReglamentoEvento,
        reglamentoVersion: data.reglamento_version,
        fechaInicio: data.fecha_inicio as FechaISO,
        fechaFin: data.fecha_fin as FechaISO,
        inscripcionApertura: data.inscripcion_apertura,
        inscripcionCierre: data.inscripcion_cierre,
        modificacionesCierre: data.modificaciones_cierre,
      };
    },
    async puedeEditar(ficha) {
      return {
        academia: sesion.academias.some((a) => a.id === ficha.academiaId),
        gestor: tienePermiso(sesion, ficha.eventoId, 'inscripciones.gestionar'),
      };
    },
    async guardarValidacion(fichaId, resultado, version, nuevoEstado) {
      const admin = supabaseAdmin();
      const { error } = await admin
        .from('ficha')
        .update({
          validacion: resultado as unknown as Json,
          categoria: resultado.categoria,
          validacion_reglamento_version: version,
          ...(nuevoEstado ? { estado: nuevoEstado, observacion: 'REVALIDACION_REGLAMENTO' } : {}),
        })
        .eq('id', fichaId);
      if (error) throw new Error(`guardar validación: ${error.message}`);
      for (const i of resultado.integrantes) {
        await admin.from('ficha_bailarin').update({ edad: i.edad, categoria: i.categoria }).eq('ficha_id', fichaId).eq('bailarin_id', i.bailarinId);
      }
    },
    async marcarEnviada(fichaId) {
      const { error } = await supabaseAdmin().from('ficha').update({ estado: 'ENVIADA', enviada_at: new Date().toISOString() }).eq('id', fichaId);
      if (error) throw new Error(`enviar ficha: ${error.message}`);
    },
  };
}
