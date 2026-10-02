import 'server-only';
import type { Traducible } from '@soed/domain';
import type { ClienteSupabase } from '@/lib/supabase/server';

export interface Clase {
  id: string;
  nombre: Traducible;
  docente: string | null;
  sala: string | null;
  inicio: string;
  fin: string;
  cupo: number;
  precio: number;
  publicada: boolean;
}

export interface EntradaTipo {
  id: string;
  nombre: Traducible;
  fecha: string | null;
  cupo: number;
  precio: number;
  publicada: boolean;
}

export interface Reserva {
  id: string;
  padreId: string;
  nombre: string;
  email: string | null;
  academia: string | null;
  cantidad: number;
  estado: 'RESERVADA' | 'CONFIRMADA' | 'CANCELADA';
  pagada: boolean;
  codigo: string | null;
  creadoAt: string;
}

const ocupadas = (reservas: readonly Reserva[], padreId: string) =>
  reservas.filter((r) => r.padreId === padreId && r.estado !== 'CANCELADA').reduce((n, r) => n + r.cantidad, 0);

/** Clases y entradas del evento con sus reservas (OR-51 a OR-53). RLS: configurar o registrar cobros. */
export async function actividadesDeGestion(db: ClienteSupabase, eventoId: string) {
  const [{ data: clases }, { data: tipos }, { data: rClases }, { data: rEntradas }] = await Promise.all([
    db
      .from('clase')
      .select('id, nombre, docente, sala, inicio, fin, cupo, precio_centavos, publicada')
      .eq('evento_id', eventoId)
      .order('inicio'),
    db.from('entrada_tipo').select('id, nombre, fecha, cupo, precio_centavos, publicada').eq('evento_id', eventoId).order('fecha'),
    db
      .from('reserva_clase')
      .select('id, clase_id, nombre, email, academia_id, estado, pagada, creado_at')
      .eq('evento_id', eventoId)
      .order('creado_at'),
    db
      .from('reserva_entrada')
      .select('id, entrada_tipo_id, nombre, email, cantidad, estado, pagada, codigo, creado_at')
      .eq('evento_id', eventoId)
      .order('creado_at'),
  ]);
  const academiaIds = [...new Set((rClases ?? []).map((r) => r.academia_id).filter((a): a is string => !!a))];
  const { data: academias } = academiaIds.length ? await db.from('academia').select('id, nombre').in('id', academiaIds) : { data: [] };
  const academia = new Map((academias ?? []).map((a) => [a.id, a.nombre]));
  const reservasClase: Reserva[] = (rClases ?? []).map((r) => ({
    id: r.id,
    padreId: r.clase_id,
    nombre: r.nombre,
    email: r.email,
    academia: r.academia_id ? (academia.get(r.academia_id) ?? null) : null,
    cantidad: 1,
    estado: r.estado as Reserva['estado'],
    pagada: r.pagada,
    codigo: null,
    creadoAt: r.creado_at,
  }));
  const reservasEntrada: Reserva[] = (rEntradas ?? []).map((r) => ({
    id: r.id,
    padreId: r.entrada_tipo_id,
    nombre: r.nombre,
    email: r.email,
    academia: null,
    cantidad: r.cantidad,
    estado: r.estado as Reserva['estado'],
    pagada: r.pagada,
    codigo: r.codigo,
    creadoAt: r.creado_at,
  }));
  return {
    clases: (clases ?? []).map((c) => {
      const clase: Clase = {
        id: c.id,
        nombre: c.nombre as Traducible,
        docente: c.docente,
        sala: c.sala,
        inicio: c.inicio,
        fin: c.fin,
        cupo: c.cupo,
        precio: Number(c.precio_centavos),
        publicada: c.publicada,
      };
      return { ...clase, ocupadas: ocupadas(reservasClase, c.id), reservas: reservasClase.filter((r) => r.padreId === c.id) };
    }),
    entradas: (tipos ?? []).map((t) => {
      const tipo: EntradaTipo = {
        id: t.id,
        nombre: t.nombre as Traducible,
        fecha: t.fecha,
        cupo: t.cupo,
        precio: Number(t.precio_centavos),
        publicada: t.publicada,
      };
      return { ...tipo, ocupadas: ocupadas(reservasEntrada, t.id), reservas: reservasEntrada.filter((r) => r.padreId === t.id) };
    }),
  };
}

/** Clases publicadas con disponibilidad y las reservas propias de la academia (PR-31). */
export async function clasesParaAcademia(db: ClienteSupabase, slug: string, eventoId: string, academiaId: string) {
  const [{ data: clases }, { data: reservas }] = await Promise.all([
    db.rpc('publico_clases', { p_slug: slug }),
    db
      .from('reserva_clase')
      .select('id, clase_id, nombre, estado, pagada')
      .eq('evento_id', eventoId)
      .eq('academia_id', academiaId)
      .order('creado_at'),
  ]);
  return (clases ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre as Traducible,
    docente: c.docente,
    sala: c.sala,
    inicio: c.inicio,
    fin: c.fin,
    precio: Number(c.precio_centavos),
    moneda: c.moneda,
    disponibles: c.disponibles,
    reservas: (reservas ?? []).filter((r) => r.clase_id === c.id && r.estado !== 'CANCELADA'),
  }));
}
