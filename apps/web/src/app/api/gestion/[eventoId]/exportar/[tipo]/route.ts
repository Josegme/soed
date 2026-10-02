import type { Idioma, ReglamentoEvento } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { obtenerSesion, tienePermiso } from '@/lib/auth/sesion';
import { generarCsv, type ValorCsv } from '@/lib/csv';
import { libre } from '@/lib/i18n/claves';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo } from '@/lib/i18n/traducible';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  cobrosDeGestion,
  fichasDeGestion,
  liquidacionesDeGestion,
  nombresDeUsuarios,
  puntajesDeGestion,
} from '@/modules/gestion/infrastructure/consultas';

const TIPOS = ['fichas', 'liquidaciones', 'cobros', 'resultados'] as const;
type Tipo = (typeof TIPOS)[number];

/**
 * Exportación CSV del evento (OR-49). Lee con RLS del usuario, exige
 * `exportar.datos` y deja constancia en la auditoría (LGPD: datos de menores).
 * No incluye documentos ni fechas de nacimiento: solo lo necesario para operar.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventoId: string; tipo: string }> }) {
  const { eventoId: crudo, tipo: tipoCrudo } = await params;
  const eventoId = uuidSchema.safeParse(crudo);
  const tipo = TIPOS.find((t) => t === tipoCrudo);
  if (!eventoId.success || !tipo) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
  const actual = await obtenerSesion();
  if (!actual) return NextResponse.json({ codigo: 'SIN_SESION' }, { status: 401 });
  if (!tienePermiso(actual.sesion, eventoId.data, 'exportar.datos')) return NextResponse.json({ codigo: 'SIN_PERMISO' }, { status: 403 });

  const { db, sesion } = actual;
  const idioma: Idioma = idiomaDe(request.nextUrl.searchParams.get('idioma') ?? sesion.idioma);
  const t = libre(await getTranslations({ locale: idioma, namespace: 'exportar' }));
  const te = libre(await getTranslations({ locale: idioma, namespace: 'estados' }));
  const { data: evento } = await db.from('evento').select('slug, reglamento').eq('id', eventoId.data).single();
  if (!evento) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
  const reglamento = evento.reglamento as unknown as ReglamentoEvento;
  const codigo = (tipoCodigo: 'categorias' | 'formaciones' | 'generos', c: string | null) =>
    c ? nombreCodigo(reglamento, tipoCodigo, c, idioma) : '';
  const decimal = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',');

  let encabezados: string[];
  let filas: ValorCsv[][];
  switch (tipo as Tipo) {
    case 'fichas': {
      const fichas = await fichasDeGestion(db, eventoId.data);
      encabezados = [
        'academia',
        'coreografia',
        'genero',
        'formacion',
        'categoria',
        'estado',
        'integrantes',
        'cumple',
        'bloqueada',
        'musica',
      ].map((c) => t(`columnas.${c}`));
      filas = fichas.map((f) => [
        f.academia,
        f.nombre,
        codigo('generos', f.genero),
        codigo('formaciones', f.formacion),
        codigo('categorias', f.categoria),
        te(`ficha.${f.estado}`),
        f.elenco.length,
        f.valida === null ? '' : t(f.valida ? 'si' : 'no'),
        t(f.bloqueada ? 'si' : 'no'),
        t(f.tieneMusica ? 'si' : 'no'),
      ]);
      break;
    }
    case 'liquidaciones': {
      const liquidaciones = await liquidacionesDeGestion(db, eventoId.data);
      encabezados = ['numero', 'academia', 'version', 'total', 'cobrado', 'saldo', 'estado'].map((c) => t(`columnas.${c}`));
      filas = liquidaciones.map((l) => [
        l.numero,
        l.academia,
        l.version,
        decimal(l.total),
        decimal(l.cobrado),
        decimal(l.saldo),
        te(`liquidacion.${l.estado}`),
      ]);
      break;
    }
    case 'cobros': {
      const [cobros, liquidaciones] = await Promise.all([
        cobrosDeGestion(db, eventoId.data, 10_000),
        liquidacionesDeGestion(db, eventoId.data),
      ]);
      const personas = await nombresDeUsuarios(
        db,
        cobros.map((c) => c.registrado_por),
      );
      const liq = new Map(liquidaciones.map((l) => [l.id, l]));
      encabezados = ['fecha', 'numero', 'academia', 'medio', 'monto', 'referencia', 'registradoPor', 'anulado', 'motivoAnulacion'].map(
        (c) => t(`columnas.${c}`),
      );
      filas = cobros.map((c) => [
        c.registrado_at,
        liq.get(c.liquidacion_id)?.numero ?? '',
        liq.get(c.liquidacion_id)?.academia ?? '',
        c.medio,
        decimal(Number(c.monto_centavos)),
        c.referencia,
        personas.get(c.registrado_por) ?? '',
        t(c.anulado_at ? 'si' : 'no'),
        c.motivo_anulacion,
      ]);
      break;
    }
    case 'resultados': {
      const { resultados } = await puntajesDeGestion(db, eventoId.data);
      encabezados = ['grupo', 'puesto', 'coreografia', 'academia', 'puntaje', 'banda'].map((c) => t(`columnas.${c}`));
      filas = resultados.map((r) => [r.grupo, r.puesto, r.ficha, r.academia, r.puntaje.toFixed(2).replace('.', ','), r.banda]);
      break;
    }
  }

  // Constancia de la exportación en el registro de auditoría (sin volcar los datos).
  await supabaseAdmin()
    .from('auditoria')
    .insert({
      usuario_id: sesion.usuarioId,
      evento_id: eventoId.data,
      tabla: 'exportacion',
      registro_id: tipo,
      accion: 'INSERT',
      despues: { tipo, filas: filas.length },
    });

  const nombre = `${evento.slug}-${tipo}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(generarCsv(encabezados, filas), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${nombre}"`,
      'cache-control': 'private, no-store',
    },
  });
}
