import type { Idioma } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { obtenerSesion } from '@/lib/auth/sesion';
import { generarCsv, type ValorCsv } from '@/lib/csv';
import { libre } from '@/lib/i18n/claves';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { historialDeTemporada, tableroTemporada } from '@/modules/temporadas/infrastructure/consultas';

const TIPOS = ['eventos', 'historial'] as const;

/**
 * Exportación CSV de la temporada (SA-18): solo Super Admin; lee con su RLS y
 * deja constancia en la auditoría. Los montos van por moneda, sin conversión.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ temporadaId: string; tipo: string }> }) {
  const { temporadaId: crudo, tipo: tipoCrudo } = await params;
  const temporadaId = uuidSchema.safeParse(crudo);
  const tipo = TIPOS.find((t) => t === tipoCrudo);
  if (!temporadaId.success || !tipo) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
  const actual = await obtenerSesion();
  if (!actual) return NextResponse.json({ codigo: 'SIN_SESION' }, { status: 401 });
  if (!actual.sesion.esSuperAdmin) return NextResponse.json({ codigo: 'SIN_PERMISO' }, { status: 403 });

  const { db, sesion } = actual;
  const idioma: Idioma = idiomaDe(request.nextUrl.searchParams.get('idioma') ?? sesion.idioma);
  const t = libre(await getTranslations({ locale: idioma, namespace: 'exportar' }));
  const te = libre(await getTranslations({ locale: idioma, namespace: 'estados.evento' }));
  const decimal = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

  let encabezados: string[];
  let filas: ValorCsv[][];
  let anio: number;
  if (tipo === 'eventos') {
    const datos = await tableroTemporada(db, temporadaId.data);
    if (!datos) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
    anio = datos.temporada.anio;
    const metricas = new Map(datos.resumen.eventos.map((m) => [m.eventoId, m]));
    encabezados = [
      'evento',
      'nombreEvento',
      'estado',
      'inicio',
      'fin',
      'academias',
      'fichas',
      'aprobadas',
      'moneda',
      'esperado',
      'cobrado',
      'saldo',
    ].map((c) => t(`columnas.${c}`));
    // Una fila por evento y moneda: un evento sin liquidaciones igual aparece.
    filas = datos.eventos.flatMap((e) => {
      const m = metricas.get(e.id);
      const base: ValorCsv[] = [
        e.slug,
        texto(e.nombre, idioma, e.idioma_defecto as Idioma),
        te(e.estado),
        e.fecha_inicio,
        e.fecha_fin,
        m?.academias ?? 0,
        m?.fichas ?? 0,
        m?.fichasAprobadas ?? 0,
      ];
      const cobranza = m?.cobranza ?? [];
      return cobranza.length === 0
        ? [[...base, e.moneda, decimal(0), decimal(0), decimal(0)]]
        : cobranza.map((c) => [...base, c.moneda, decimal(c.esperado), decimal(c.cobrado), decimal(c.pendiente)]);
    });
  } else {
    const datos = await historialDeTemporada(db, temporadaId.data, {});
    if (!datos) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
    anio = datos.temporada.anio;
    const slugs = new Map(datos.eventos.map((e) => [e.id, e.slug]));
    encabezados = ['academia', 'coreografia', 'evento', 'grupo', 'puesto', 'puntaje', 'banda', 'pases'].map((c) => t(`columnas.${c}`));
    filas = datos.filas.map((f) => [
      f.academia,
      f.coreografia,
      slugs.get(f.eventoId) ?? '',
      f.grupo,
      f.puesto,
      f.puntaje.toFixed(2).replace('.', ','),
      f.banda,
      f.pases.join(' | '),
    ]);
  }

  await supabaseAdmin()
    .from('auditoria')
    .insert({
      usuario_id: sesion.usuarioId,
      tabla: 'exportacion',
      registro_id: `temporada:${temporadaId.data}:${tipo}`,
      accion: 'INSERT',
      despues: { tipo, temporadaId: temporadaId.data, filas: filas.length },
    });

  const nombre = `temporada-${anio}-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(generarCsv(encabezados, filas), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nombre}"`,
      'cache-control': 'private, no-store',
    },
  });
}
