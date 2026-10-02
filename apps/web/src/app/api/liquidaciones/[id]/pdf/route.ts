import { renderToBuffer } from '@react-pdf/renderer';
import type { ConceptoLinea, Idioma } from '@soed/domain';
import { uuidSchema } from '@soed/shared-types';
import { NextResponse, type NextRequest } from 'next/server';
import { createElement } from 'react';
import { getTranslations } from 'next-intl/server';
import { cliente } from '@/cliente';
import { obtenerSesion } from '@/lib/auth/sesion';
import { formatearInstante, formatearMonto } from '@/lib/i18n/formato';
import { idiomaDe } from '@/lib/i18n/locales';
import { texto } from '@/lib/i18n/traducible';
import { datosDocumentoLiquidacion } from '@/modules/liquidaciones/infrastructure/documento';
import { DocumentoLiquidacion } from '@/modules/liquidaciones/interface/documento-pdf';

export const runtime = 'nodejs';

/** PDF de la última versión emitida (PR-16). Idioma: ?idioma= o el de la emisión. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) return NextResponse.json({ codigo: 'NO_ENCONTRADA' }, { status: 404 });
  const actual = await obtenerSesion();
  if (!actual) return NextResponse.json({ codigo: 'SIN_SESION' }, { status: 401 });
  const datos = await datosDocumentoLiquidacion(actual.db, id.data);
  if (!datos) return NextResponse.json({ codigo: 'NO_ENCONTRADA' }, { status: 404 });

  const idioma: Idioma = idiomaDe(request.nextUrl.searchParams.get('idioma') ?? datos.idiomaEmision);
  const t = await getTranslations({ locale: idioma, namespace: 'liquidacionPdf' });
  const tc = await getTranslations({ locale: idioma, namespace: 'academia.inscripcion' });
  const monto = (c: number) => formatearMonto(c, datos.moneda, idioma);
  const defecto = datos.evento.defecto as Idioma;
  const filas = (datos.detalle.lineas ?? []).map((l) => ({
    concepto: tc(`conceptos.${l.concepto as ConceptoLinea}`),
    detalle: l.referencia ? (datos.fichas.get(l.referencia) ?? l.referencia) : undefined,
    cantidad: String(l.cantidad),
    unitario: monto(l.precioUnitario),
    importe: monto(l.importe),
  }));
  const buffer = await renderToBuffer(
    createElement(DocumentoLiquidacion, {
      color: cliente.marca.colorTema,
      textos: {
        titulo: t('titulo'),
        marca: cliente.nombre,
        numero: datos.numero,
        version: `${datos.numero} · ${t('version', { version: datos.version })}`,
        emitida: t('emitida', { fecha: formatearInstante(datos.emitidaAt, idioma, datos.evento.zona) }),
        evento: texto(datos.evento.nombre, idioma, defecto),
        academia: datos.academia,
        encabezados: { concepto: t('concepto'), cantidad: t('cantidad'), unitario: t('unitario'), importe: t('importe') },
        filas,
        totales: [
          { etiqueta: t('subtotal'), valor: monto(datos.detalle.subtotal ?? datos.total) },
          { etiqueta: t('total'), valor: monto(datos.total), destacado: true },
          { etiqueta: t('cobrado'), valor: monto(datos.cobrado) },
          { etiqueta: t('saldo'), valor: monto(Math.max(0, datos.saldo)), destacado: true },
        ],
        datosPagoTitulo: t('datosPago'),
        datosPago: texto(datos.evento.datosPago, idioma, defecto),
        leyenda: tc('noEsFactura'),
        pie: t('pie', { marca: cliente.nombre, fecha: formatearInstante(new Date(), idioma, datos.evento.zona) }),
      },
    }) as Parameters<typeof renderToBuffer>[0],
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${datos.numero}-v${datos.version}.pdf"`,
      'cache-control': 'private, no-store',
    },
  });
}
