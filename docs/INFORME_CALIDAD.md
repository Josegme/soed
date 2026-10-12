# Informe de calidad

Corrida del 02/10/2026 sobre la rama `claude/lucid-knuth-yxeavq` (commit `78fa7ab`). Todo se ejecutó en local con los mismos scripts que CI; no hay resultados de entornos remotos porque las instancias todavía no existen (`docs/PENDIENTES.md`).

## Resultados

| Suite                      | Comando                                            | Resultado                                                                                              |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Formato, lint, tipos       | `pnpm format:check && pnpm lint && pnpm typecheck` | Sin errores                                                                                            |
| i18n                       | `pnpm i18n:check`                                  | Claves `es` y `pt-BR` completas                                                                        |
| Dominio                    | `pnpm --filter @soed/domain test:coverage`         | 103 pruebas · 99 % sentencias · 95,97 % ramas · 98,8 % funciones (mínimo CI: 90 %)                     |
| Tipos compartidos y emails | `pnpm test`                                        | 9 + 2 pruebas                                                                                          |
| Aplicación web             | `pnpm test`                                        | 96 pruebas                                                                                             |
| Base de datos              | `pnpm db:test`                                     | 202 aserciones pgTAP en 11 archivos (RLS por rol, guardas, cupos, límite de frecuencia, índices de FK) |
| Integración                | `pnpm test:integracion`                            | 35 pruebas contra PostgREST real                                                                       |
| E2E sitio público          | `pnpm test:e2e`                                    | 32 pruebas (escritorio y móvil)                                                                        |
| E2E panel                  | `pnpm test:e2e:panel`                              | 96 pruebas, con verificación axe WCAG 2.2 AA en cada pantalla nueva                                    |
| Trazabilidad               | `pnpm trace`                                       | 184 de 207 funcionalidades con prueba (89 %)                                                           |

## Accesibilidad (WCAG 2.2 AA)

- axe en cada pantalla del panel y del sitio público (violaciones serias o críticas = falla). La verificación analiza desde el inicio de la página para no confundir solapamientos del encabezado fijo con objetivos pequeños.
- Contraste de la paleta de cada cliente verificado en CI (`pnpm contraste`).
- Formularios con etiqueta, errores asociados y mensajes en `role=status` / `role=alert`; salto al contenido; foco visible; tamaños de toque de 44 px.
- Campo trampa anti-bots fuera del árbol de accesibilidad.

## Seguridad

| Control                                                             | Evidencia                                                       |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| RLS en todas las tablas, por evento y por rol                       | pgTAP 010–090                                                   |
| `service_role` acotado a infraestructura y API                      | Regla ESLint `no-restricted-imports`                            |
| Público sin acceso a tablas; RPC sin datos personales               | pgTAP 040 y 070 (`[TR-33]`)                                     |
| Art. 32: resultados, devoluciones y certificados solo tras publicar | pgTAP 050; e2e `resultados.spec.ts`                             |
| Límite de frecuencia y anti-bots en reservas públicas               | pgTAP 090; e2e `actividades.spec.ts`                            |
| Exportaciones auditadas y CSV con neutralización de fórmulas        | e2e `documentos.spec.ts`, `temporada.spec.ts`; unitarias de CSV |
| Cabeceras: CSP, HSTS, nosniff, frame-ancestors, Permissions-Policy  | e2e público                                                     |
| Emails reales solo en producción                                    | e2e `notificaciones.spec.ts` (todo `SIMULADO`)                  |
| Pendiente                                                           | CSP con nonce (hoy `'unsafe-inline'`)                           |

## Rendimiento de Postgres

- Índice en toda clave foránea, verificado por pgTAP; índices compuestos para las consultas por `(evento_id, …)`.
- Políticas con `(select auth.uid())` y helpers `stable security definer` en `private`, evaluados una vez por consulta.
- Lecturas masivas paginadas (`leerTodo`) para no cortar en `max-rows`; filtros `in` en lotes de 100.
- Cupos con bloqueo de la fila padre y no de la tabla.
- Pendiente con datos reales: `explain analyze` de las vistas `v_liquidacion_estado` y `v_resumen_cobranza` con una temporada de +100 academias, y prueba de carga de Realtime antes del primer evento en vivo.

## Limitaciones conocidas

- Realtime, Auth (magic link) y Storage se prueban con un doble local; se validan en staging según `docs/runbooks/ALTA_CLIENTE.md`.
- Los crons se ejercitan por HTTP en e2e; la programación de Vercel se verifica en el primer despliegue.
