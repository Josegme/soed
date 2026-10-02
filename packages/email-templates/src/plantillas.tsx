import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text, render } from '@react-email/components';
import type { ReactNode } from 'react';

/**
 * Plantillas de email (ADR-0013). No contienen textos fijos: reciben los textos
 * ya traducidos al idioma del destinatario desde los catálogos de mensajes de
 * la app (TR-22). Estilos en línea por compatibilidad con clientes de correo.
 */
export interface MarcaEmail {
  nombre: string;
  colorMarca: string;
  colorAcento: string;
  urlSitio: string;
  pie: string;
}

interface Base {
  idioma: string;
  marca: MarcaEmail;
  vistaPrevia: string;
}

const estilos = {
  cuerpo: { backgroundColor: '#f4f6f8', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px 0' },
  contenedor: { backgroundColor: '#ffffff', borderRadius: 12, margin: '0 auto', maxWidth: 560, padding: 32 },
  titulo: { color: '#111827', fontSize: 22, lineHeight: '30px', margin: '0 0 16px' },
  parrafo: { color: '#1f2937', fontSize: 15, lineHeight: '24px', margin: '0 0 12px' },
  pie: { color: '#4b5563', fontSize: 12, lineHeight: '18px' },
  fila: { color: '#1f2937', fontSize: 15, lineHeight: '24px', margin: 0 },
} as const;

function Marco({ idioma, marca, vistaPrevia, children }: Base & { children: ReactNode }) {
  return (
    <Html lang={idioma}>
      <Head />
      <Preview>{vistaPrevia}</Preview>
      <Body style={estilos.cuerpo}>
        <Container style={estilos.contenedor}>
          <Text style={{ ...estilos.fila, color: marca.colorMarca, fontWeight: 700, marginBottom: 20 }}>{marca.nombre}</Text>
          {children}
          <Hr style={{ borderColor: '#e5e7eb', margin: '24px 0' }} />
          <Text style={estilos.pie}>{marca.pie}</Text>
        </Container>
      </Body>
    </Html>
  );
}

function BotonEmail({ href, texto, color }: { href: string; texto: string; color: string }) {
  return (
    <Section style={{ margin: '20px 0' }}>
      <Button
        href={href}
        style={{ backgroundColor: color, borderRadius: 10, color: '#ffffff', fontSize: 15, fontWeight: 700, padding: '12px 20px' }}
      >
        {texto}
      </Button>
    </Section>
  );
}

export interface EmailAccion extends Base {
  titulo: string;
  parrafos: string[];
  /** Pares etiqueta/valor ya formateados (montos, fechas, números). */
  detalle?: { etiqueta: string; valor: string }[];
  accion?: { texto: string; url: string };
  nota?: string;
}

/** Plantilla genérica: inscripción confirmada, liquidación emitida, cobro registrado, resultados publicados. */
export function EmailTransaccional(p: EmailAccion) {
  return (
    <Marco idioma={p.idioma} marca={p.marca} vistaPrevia={p.vistaPrevia}>
      <Heading style={estilos.titulo}>{p.titulo}</Heading>
      {p.parrafos.map((texto) => (
        <Text key={texto} style={estilos.parrafo}>
          {texto}
        </Text>
      ))}
      {p.detalle && p.detalle.length > 0 ? (
        <Section style={{ backgroundColor: '#f9fafb', borderRadius: 8, padding: 16 }}>
          {p.detalle.map((d) => (
            <Text key={d.etiqueta} style={estilos.fila}>
              <strong>{d.etiqueta}:</strong> {d.valor}
            </Text>
          ))}
        </Section>
      ) : null}
      {p.accion ? <BotonEmail href={p.accion.url} texto={p.accion.texto} color={p.marca.colorMarca} /> : null}
      {p.nota ? <Text style={{ ...estilos.pie, marginTop: 16 }}>{p.nota}</Text> : null}
    </Marco>
  );
}

export interface EmailComunicado extends Base {
  asunto: string;
  cuerpo: string;
}

/** Comunicado del organizador: el cuerpo es texto plano con saltos de línea. */
export function EmailComunicadoEvento(p: EmailComunicado) {
  return (
    <Marco idioma={p.idioma} marca={p.marca} vistaPrevia={p.vistaPrevia}>
      <Heading style={estilos.titulo}>{p.asunto}</Heading>
      {p.cuerpo.split(/\n{2,}/).map((parrafo, i) => (
        <Text key={i} style={{ ...estilos.parrafo, whiteSpace: 'pre-line' }}>
          {parrafo}
        </Text>
      ))}
    </Marco>
  );
}

export interface EmailRenderizado {
  html: string;
  texto: string;
}

export async function renderizarTransaccional(p: EmailAccion): Promise<EmailRenderizado> {
  const elemento = <EmailTransaccional {...p} />;
  return { html: await render(elemento), texto: await render(elemento, { plainText: true }) };
}

export async function renderizarComunicado(p: EmailComunicado): Promise<EmailRenderizado> {
  const elemento = <EmailComunicadoEvento {...p} />;
  return { html: await render(elemento), texto: await render(elemento, { plainText: true }) };
}
