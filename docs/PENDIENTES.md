# Pendientes y decisiones abiertas

Actualizado: 02/10/2026. Cada ítem indica quién decide y qué queda bloqueado. Nada de esta lista se ejecuta sin aprobación explícita.

## Bloqueantes para publicar la primera instancia

| #    | Pendiente                                                                 | Decide                | Bloquea                      | Recomendación                                                                                   |
| ---- | ------------------------------------------------------------------------- | --------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------- |
| P-01 | Instalar la GitHub App de Claude en el repositorio (el push devolvió 403) | Dueño del repo        | Push de la rama y PRs        | Instalar la App con acceso solo a este repo; luego se publica la rama y se abre un PR por etapa |
| P-02 | Visibilidad del repositorio                                               | Dueño del repo        | —                            | Privado: contiene reglas de negocio del cliente y su configuración                              |
| P-03 | Organización y región de Supabase                                         | Responsable comercial | Base de staging y producción | Plan Pro (backups PITR) en `sa-east-1` (São Paulo)                                              |
| P-04 | Equipo y plan de Vercel                                                   | Responsable comercial | Despliegue y crons           | Pro: el cron de emails cada 5 min no corre en Hobby (allí quedaría diario)                      |
| P-05 | Dominio de producción y DNS                                               | Cliente               | Sitio, emails, QR            | Subdominio del cliente (p. ej. `inscripciones.<cliente>.com`)                                   |
| P-06 | Dominio de envío y API key de Resend                                      | Cliente + operador    | Emails reales                | Verificar SPF, DKIM y DMARC antes de pasar `EMAIL_MODO=resend`                                  |
| P-07 | Rama principal `main` para PRs                                            | Dueño del repo        | Flujo de PR por etapa        | Crear `main` desde el primer commit aprobado                                                    |

## Insumos de negocio

| #    | Pendiente                                        | Impacto                                                                                                                                   | Estado actual                                                                             |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| N-01 | `FUNCIONALIDADES.md` v1.2 original               | El inventario se reconstruyó (207 ítems) desde el plan, el prompt y el CLAUDE.md                                                          | Validar el inventario contra el original cuando esté disponible                           |
| N-02 | Bases y Condiciones 2026 completas               | El preset `encuentro-2026` tiene supuestos listados en `reglamento.supuestos` (edades exactas, catálogo de géneros, tiempos salvo Quadro) | Confirmar o corregir cada supuesto; el organizador puede ajustar el reglamento por evento |
| N-03 | Calendario 2027 (selectivos y final)             | Carga inicial de la temporada                                                                                                             | Se carga desde el panel del Super Admin                                                   |
| N-04 | Regla de desempate para hoteles (S-08)           | Prioridad por primer pago o por inscripción                                                                                               | Configurable por hotel; por defecto primer pago                                           |
| N-05 | Textos legales (términos y privacidad, es/pt-BR) | Páginas `/legal/*` y LGPD                                                                                                                 | El template muestra "PENDIENTE" en razón social                                           |
| N-06 | ¿Un organizador administra más de un evento?     | Asignación de equipos                                                                                                                     | Soportado: se lo asigna el Super Admin en cada evento                                     |

## Mejoras planificadas (no bloquean)

- CSP con nonce (hoy `'unsafe-inline'` por la hidratación estática, S-03 de la revisión de seguridad).
- Notificaciones push de la PWA (TR-51) y app nativa (TR-52): fuera de alcance hasta tener datos de uso.
- Traducción asistida por IA con revisión humana (TR-26): opcional; hoy la vista de traducciones pendientes guía la carga manual.
- Observabilidad (TR-48): logs estructurados sin PII y alertas de errores; elegir proveedor junto con el plan de Vercel.
