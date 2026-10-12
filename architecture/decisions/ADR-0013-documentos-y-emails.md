# ADR-0013 · Generación de documentos y emails transaccionales

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

SOED emite liquidaciones, credenciales, certificados, orden del día y exportaciones, todos en el idioma del destinatario. Los emails salen por Resend con el dominio verificado de cada cliente.

## Decisión

1. **PDF** con `@react-pdf/renderer` en Route Handlers (runtime Node). Plantillas en `apps/web/src/modules/documentos/` que reciben datos ya traducidos. Los PDFs se guardan en el bucket privado `documentos` y se entregan con URL firmada de 5 minutos.
2. **QR** con `qrcode`, codificando una URL de la instancia con un token aleatorio, nunca datos personales.
3. **Exportaciones** CSV (UTF-8 con BOM para Excel) generadas en streaming; las de más de 10.000 filas pasan a la cola.
4. **Emails** con React Email (`packages/email-templates`), una plantilla por tipo y textos desde los mismos catálogos de mensajes. El envío se encola (`email_envio` + pgmq) y lo procesa una Edge Function con reintentos. En desarrollo y preview el adaptador es un _sink_ que no envía a terceros (`EMAIL_MODO=sink`).

## Alternativas

| Opción                         | Contras                         | Veredicto   |
| ------------------------------ | ------------------------------- | ----------- |
| Puppeteer / Chromium en Vercel | Binario pesado y arranque lento | Descartada  |
| `pdf-lib` a mano               | Maquetado costoso               | Descartada  |
| **`@react-pdf/renderer`**      | Subconjunto de CSS              | **Elegida** |

## Consecuencias

- Ningún email real a terceros se envía desde entornos que no sean producción.
- La aclaración "no es factura ni comprobante fiscal" es una clave de traducción obligatoria en la plantilla de liquidación.

## Actualización 2026-10-02 (implementación)

Lo implementado difiere en tres puntos; se mantiene el objetivo y cambia el mecanismo:

1. **PDF a demanda, sin almacenar.** Liquidaciones y certificados se generan en cada descarga (`/api/liquidaciones/[id]/pdf`, `/api/certificados/[eventoId]`) leyendo con el cliente del usuario: la RLS decide qué ve cada uno y el documento refleja siempre la última versión. No hay bucket `documentos` ni URLs firmadas para PDFs; las liquidaciones siguen siendo inmutables por versión (`liquidacion_version`).
2. **Cola de emails en `email_envio` + Vercel Cron**, sin pgmq ni Edge Functions: las acciones encolan (estado `PENDIENTE` en producción, `SIMULADO` en cualquier otro entorno) y `/api/cron/emails` (cada 5 min, protegido con `CRON_SECRET`) envía por Resend con `idempotencyKey` = id de la fila y reintentos acotados. Los recordatorios (`/api/cron/recordatorios`, diario) deduplican por `clave`. Cron cada 5 minutos requiere plan Pro de Vercel; en Hobby queda diario (ver `docs/PENDIENTES.md`).
3. **Orden del día** se imprime desde el navegador (`/gestion/[eventoId]/orden/imprimir`, estilos `print:`) en el idioma de la ruta, en lugar de un PDF del servidor.

Además, la publicación del evento es coherente por construcción: `evento.publicado = estado in ('PUBLICADO','EN_CURSO','FINALIZADO')` (restricción en la base).
