# ADR-0013 · Generación de documentos y emails transaccionales

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

SOED emite liquidaciones, credenciales, certificados, orden del día y exportaciones, todos en el idioma del destinatario. Los emails salen por Resend con el dominio verificado de cada cliente.

## Decisión

1. **PDF** con `@react-pdf/renderer` en Route Handlers (runtime Node). Plantillas en `apps/web/src/modules/documentos/` que reciben datos ya traducidos. Los PDFs se guardan en el bucket privado `documentos` y se entregan con URL firmada de 5 minutos.
2. **QR** con `qrcode`, codificando una URL de la instancia con un token aleatorio, nunca datos personales.
3. **Exportaciones** CSV (UTF-8 con BOM para Excel) generadas en streaming; las de más de 10.000 filas pasan a la cola.
4. **Emails** con React Email (`packages/email-templates`), una plantilla por tipo y textos desde los mismos catálogos de mensajes. El envío se encola (`email_envio` + pgmq) y lo procesa una Edge Function con reintentos. En desarrollo y preview el adaptador es un *sink* que no envía a terceros (`EMAIL_MODO=sink`).

## Alternativas

| Opción | Contras | Veredicto |
| --- | --- | --- |
| Puppeteer / Chromium en Vercel | Binario pesado y arranque lento | Descartada |
| `pdf-lib` a mano | Maquetado costoso | Descartada |
| **`@react-pdf/renderer`** | Subconjunto de CSS | **Elegida** |

## Consecuencias

- Ningún email real a terceros se envía desde entornos que no sean producción.
- La aclaración "no es factura ni comprobante fiscal" es una clave de traducción obligatoria en la plantilla de liquidación.
