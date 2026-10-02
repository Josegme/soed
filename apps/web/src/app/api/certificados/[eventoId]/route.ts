import { renderToBuffer } from '@react-pdf/renderer';
import type { Idioma } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { NextResponse, type NextRequest } from 'next/server';
import { createElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { cliente } from '@/cliente';
import { obtenerSesion } from '@/lib/auth/sesion';
import { formatearPuntaje, formatearRangoFechas } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { nombreCodigo, texto } from '@/lib/i18n/traducible';
import { datosCertificados } from '@/modules/documentos/infrastructure/certificados';
import { DocumentoCertificados } from '@/modules/documentos/interface/certificado-pdf';

export const runtime = 'nodejs';

/**
 * Certificados en PDF (OR-44, PR-32) en el idioma pedido (?idioma=es|pt-BR):
 * el mismo resultado genera el certificado en cualquiera de los dos. Con
 * ?ficha= devuelve uno; sin él, todos los que la RLS deja ver al usuario.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ eventoId: string }> }) {
  const eventoId = uuidSchema.safeParse((await params).eventoId);
  const fichaCruda = request.nextUrl.searchParams.get('ficha');
  const ficha = fichaCruda ? uuidSchema.safeParse(fichaCruda) : null;
  if (!eventoId.success || (ficha && !ficha.success)) return NextResponse.json({ codigo: 'NO_ENCONTRADO' }, { status: 404 });
  const actual = await obtenerSesion();
  if (!actual) return NextResponse.json({ codigo: 'SIN_SESION' }, { status: 401 });
  const datos = await datosCertificados(actual.db, eventoId.data, ficha?.data);
  if (!datos || datos.certificados.length === 0) return NextResponse.json({ codigo: 'SIN_CERTIFICADOS' }, { status: 404 });

  const idioma: Idioma = idiomaDe(request.nextUrl.searchParams.get('idioma') ?? actual.sesion.idioma);
  const t = await getTranslations({ locale: idioma, namespace: 'certificado' });
  const { evento } = datos;
  const defecto = evento.defecto as Idioma;
  const nombreEvento = texto(evento.nombre, idioma, defecto);
  const lugar = [evento.sede.venue, evento.sede.ciudad, evento.sede.pais].filter(Boolean).join(', ');
  const fechas = formatearRangoFechas(evento.fechaInicio, evento.fechaFin, idioma);
  const codigo = (tipo: 'categorias' | 'formaciones' | 'generos', c: string | null) =>
    c && evento.reglamento ? nombreCodigo(evento.reglamento, tipo, c, idioma) : (c ?? '');
  const banda = (c: string | null) => (c ? texto(evento.reglamento?.bandas.find((b) => b.codigo === c)?.nombre, idioma) || c : null);

  const certificados = datos.certificados.map((c) => {
    const nombreBanda = banda(c.banda);
    return {
      marca: cliente.nombre,
      titulo: t('titulo'),
      cuerpo: t('cuerpo', { coreografia: c.coreografia, academia: c.academia, evento: nombreEvento }),
      distincion: nombreBanda
        ? t('distincionBanda', { banda: nombreBanda, puesto: c.puesto })
        : t('distincionPuesto', { puesto: c.puesto }),
      detalle: [
        codigo('categorias', c.categoria),
        codigo('formaciones', c.formacion),
        codigo('generos', c.genero),
        t('puntaje', { puntaje: formatearPuntaje(c.puntaje, idioma, evento.reglamento?.puntaje?.decimalesResultado ?? 2) }),
      ]
        .filter(Boolean)
        .join(' · '),
      elencoTitulo: t('elenco'),
      elenco: c.elenco.join(' · '),
      lugarFecha: [lugar, fechas].filter(Boolean).join(' · '),
      firma: t('firma', { marca: cliente.nombre }),
    };
  });
  const buffer = await renderToBuffer(
    createElement(DocumentoCertificados, { certificados, color: cliente.marca.colorTema }) as Parameters<typeof renderToBuffer>[0],
  );
  const sufijo = ficha ? `-${ficha.data.slice(0, 8)}` : '';
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${evento.slug}-certificados${sufijo}-${idioma}.pdf"`,
      'cache-control': 'private, no-store',
    },
  });
}
