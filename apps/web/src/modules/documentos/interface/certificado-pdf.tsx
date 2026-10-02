import 'server-only';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

export interface TextosCertificado {
  marca: string;
  titulo: string;
  /** Frase principal ya interpolada: "Se certifica que la coreografía «X» de Y participó en Z". */
  cuerpo: string;
  distincion: string | null;
  detalle: string;
  elencoTitulo: string;
  elenco: string;
  lugarFecha: string;
  firma: string;
}

const estilos = (color: string) =>
  StyleSheet.create({
    pagina: { padding: 36, fontFamily: 'Helvetica', color: '#1a1d21' },
    marco: { flexGrow: 1, borderWidth: 3, borderColor: color, borderRadius: 6, padding: 40, justifyContent: 'space-between' },
    marca: { fontSize: 12, fontFamily: 'Helvetica-Bold', color, textAlign: 'center', letterSpacing: 2, textTransform: 'uppercase' },
    titulo: { fontSize: 34, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginTop: 12 },
    cuerpo: { fontSize: 15, textAlign: 'center', lineHeight: 1.5, marginTop: 24, paddingHorizontal: 30 },
    distincion: { fontSize: 20, fontFamily: 'Helvetica-Bold', color, textAlign: 'center', marginTop: 16 },
    detalle: { fontSize: 11, color: '#5b6470', textAlign: 'center', marginTop: 8 },
    elencoTitulo: { fontSize: 8, color: '#5b6470', textTransform: 'uppercase', textAlign: 'center', marginTop: 18 },
    elenco: { fontSize: 9, textAlign: 'center', marginTop: 4, paddingHorizontal: 40, lineHeight: 1.4 },
    pie: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 },
    lugar: { fontSize: 10, color: '#5b6470' },
    firma: { width: 200, borderTopWidth: 1, borderTopColor: '#1a1d21', paddingTop: 4, fontSize: 10, textAlign: 'center' },
  });

/** Certificados de participación y distinción (OR-44, PR-32): una página A4 apaisada por coreografía. */
export function DocumentoCertificados({ certificados, color }: { certificados: readonly TextosCertificado[]; color: string }) {
  const s = estilos(color);
  return (
    <Document>
      {certificados.map((c, i) => (
        <Page key={i} size="A4" orientation="landscape" style={s.pagina}>
          <View style={s.marco}>
            <View>
              <Text style={s.marca}>{c.marca}</Text>
              <Text style={s.titulo}>{c.titulo}</Text>
              <Text style={s.cuerpo}>{c.cuerpo}</Text>
              {c.distincion ? <Text style={s.distincion}>{c.distincion}</Text> : null}
              <Text style={s.detalle}>{c.detalle}</Text>
              {c.elenco ? (
                <>
                  <Text style={s.elencoTitulo}>{c.elencoTitulo}</Text>
                  <Text style={s.elenco}>{c.elenco}</Text>
                </>
              ) : null}
            </View>
            <View style={s.pie}>
              <Text style={s.lugar}>{c.lugarFecha}</Text>
              <Text style={s.firma}>{c.firma}</Text>
            </View>
          </View>
        </Page>
      ))}
    </Document>
  );
}
