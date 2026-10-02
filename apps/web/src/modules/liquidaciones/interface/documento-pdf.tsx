import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface TextosLiquidacionPdf {
  titulo: string;
  marca: string;
  numero: string;
  version: string;
  emitida: string;
  evento: string;
  academia: string;
  encabezados: { concepto: string; cantidad: string; unitario: string; importe: string };
  filas: { concepto: string; detalle?: string; cantidad: string; unitario: string; importe: string }[];
  totales: { etiqueta: string; valor: string; destacado?: boolean }[];
  datosPagoTitulo: string;
  datosPago: string;
  leyenda: string;
  pie: string;
}

const estilos = (color: string) =>
  StyleSheet.create({
    pagina: { padding: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#1a1d21' },
    cabecera: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottomWidth: 2,
      borderBottomColor: color,
      paddingBottom: 12,
      marginBottom: 16,
    },
    marca: { fontSize: 14, fontFamily: 'Helvetica-Bold', color },
    titulo: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
    numero: { fontSize: 11, textAlign: 'right', marginTop: 2 },
    meta: { flexDirection: 'row', gap: 24, marginBottom: 16 },
    metaBloque: { flexGrow: 1 },
    etiqueta: { fontSize: 8, color: '#5b6470', textTransform: 'uppercase', marginBottom: 2 },
    valor: { fontSize: 11 },
    tabla: { borderWidth: 1, borderColor: '#d9dde3', borderRadius: 4 },
    filaEncabezado: { flexDirection: 'row', backgroundColor: '#f1f3f6', paddingVertical: 6, paddingHorizontal: 8 },
    fila: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: '#e6e9ee' },
    colConcepto: { flexGrow: 1, flexBasis: 0 },
    colNumero: { width: 70, textAlign: 'right' },
    colImporte: { width: 90, textAlign: 'right' },
    negrita: { fontFamily: 'Helvetica-Bold' },
    detalle: { fontSize: 8, color: '#5b6470', marginTop: 1 },
    totales: { marginTop: 12, marginLeft: 'auto', width: 240 },
    total: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
    destacado: { borderTopWidth: 1, borderTopColor: color, marginTop: 4, paddingTop: 6, fontFamily: 'Helvetica-Bold', fontSize: 12 },
    pago: { marginTop: 20, padding: 10, backgroundColor: '#f7f8fa', borderRadius: 4 },
    leyenda: { marginTop: 16, fontSize: 8, color: '#5b6470' },
    pie: { position: 'absolute', bottom: 24, left: 40, right: 40, fontSize: 8, color: '#8a929c', textAlign: 'center' },
  });

/** Liquidación en PDF (PR-16, OR-27): misma versión inmutable que ve la academia en pantalla. */
export function DocumentoLiquidacion({ textos, color }: { textos: TextosLiquidacionPdf; color: string }) {
  const e = estilos(color);
  return (
    <Document title={`${textos.titulo} ${textos.numero}`} author={textos.marca} language="es">
      <Page size="A4" style={e.pagina}>
        <View style={e.cabecera}>
          <Text style={e.marca}>{textos.marca}</Text>
          <View>
            <Text style={e.titulo}>{textos.titulo}</Text>
            <Text style={e.numero}>{textos.version}</Text>
          </View>
        </View>
        <View style={e.meta}>
          <View style={e.metaBloque}>
            <Text style={e.etiqueta}>{textos.evento}</Text>
            <Text style={e.valor}>{textos.academia}</Text>
          </View>
          <View>
            <Text style={e.etiqueta}>{textos.emitida}</Text>
          </View>
        </View>
        <View style={e.tabla}>
          <View style={e.filaEncabezado}>
            <Text style={[e.colConcepto, e.negrita]}>{textos.encabezados.concepto}</Text>
            <Text style={[e.colNumero, e.negrita]}>{textos.encabezados.cantidad}</Text>
            <Text style={[e.colNumero, e.negrita]}>{textos.encabezados.unitario}</Text>
            <Text style={[e.colImporte, e.negrita]}>{textos.encabezados.importe}</Text>
          </View>
          {textos.filas.map((f, i) => (
            <View key={i} style={e.fila} wrap={false}>
              <View style={e.colConcepto}>
                <Text>{f.concepto}</Text>
                {f.detalle ? <Text style={e.detalle}>{f.detalle}</Text> : null}
              </View>
              <Text style={e.colNumero}>{f.cantidad}</Text>
              <Text style={e.colNumero}>{f.unitario}</Text>
              <Text style={e.colImporte}>{f.importe}</Text>
            </View>
          ))}
        </View>
        <View style={e.totales}>
          {textos.totales.map((t) => (
            <View key={t.etiqueta} style={t.destacado ? [e.total, e.destacado] : e.total}>
              <Text>{t.etiqueta}</Text>
              <Text>{t.valor}</Text>
            </View>
          ))}
        </View>
        {textos.datosPago ? (
          <View style={e.pago}>
            <Text style={[e.etiqueta]}>{textos.datosPagoTitulo}</Text>
            <Text>{textos.datosPago}</Text>
          </View>
        ) : null}
        <Text style={e.leyenda}>{textos.leyenda}</Text>
        <Text style={e.pie} fixed>
          {textos.pie}
        </Text>
      </Page>
    </Document>
  );
}
