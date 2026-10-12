# Auditoría del plan, las specs y la implementación

02/10/2026 · Revisión de `PLAN_DESARROLLO` v1, `CLAUDE.md` v1, inventario de funcionalidades y ADR-0001 a ADR-0013 contra lo construido.

## 1. Alcance y método

1. **Inventario reconstruido.** `FUNCIONALIDADES.md` v1.2 no estaba en el repositorio; se reconstruyó desde el plan, el prompt y el CLAUDE.md: 207 funcionalidades en 7 áreas, cada una con fuente, confianza (explícita, inferida, derivada), módulo, datos y RLS, pantalla y prueba esperada (`docs/auditoria/inventario.csv`). Validar contra el original cuando esté disponible (N-01 de `docs/PENDIENTES.md`).
2. **Trazabilidad automática.** `pnpm trace` cruza el inventario con las etiquetas `[ID]` de las pruebas de cinco niveles (dominio, aplicación, pgTAP, integración, e2e) y genera `MATRIZ_TRAZABILIDAD.md`. Una etiqueta solo se agrega si la prueba ejercita de verdad la funcionalidad.
3. **Verificación.** Cada funcionalidad se implementó con su prueba; las suites completas corren en CI (ver `docs/INFORME_CALIDAD.md`).

## 2. Resultado

| Área              | Funcionalidades | Con pruebas |      % |
| ----------------- | --------------: | ----------: | -----: |
| Super Admin       |              18 |          18 |    100 |
| Organizador       |              54 |          54 |    100 |
| Profesor/Academia |              33 |          30 |     91 |
| Jurado            |              10 |           7 |     70 |
| Operativos        |              25 |          23 |     92 |
| Sitio público     |              15 |          15 |    100 |
| Transversal       |              52 |          37 |     71 |
| **Total**         |         **207** |     **184** | **89** |

Las cifras exactas se regeneran con `pnpm trace`. Las brechas restantes se clasifican en la sección 5.

## 3. Contradicciones detectadas y decisión

| ID   | Contradicción                                                                                                                           | Decisión                                                                                      | Registro                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------- |
| C-01 | El plan y CLAUDE v1 fijan Next.js 15; la versión estable al construir es 16                                                             | Next.js 16 (mismo App Router; `connection()` para render dinámico)                            | CLAUDE v2                     |
| C-02 | Tareas largas, recordatorios y ZIP con pgmq, pg_cron y Edge Functions (TR-45, OR-49, OR-50) vs. "sin infraestructura extra por cliente" | Cola `email_envio` + Vercel Cron; límites en Postgres; ZIP en el navegador                    | ADR-0013 (act.), ADR-0014     |
| C-03 | Mensajes en `messages/{es,pt}/` vs. código de idioma BCP 47                                                                             | `messages/{es,pt-BR}.json`, rutas `/es` y `/pt`                                               | ADR-0005                      |
| C-04 | Preset 2026 "en `clients/_template/seed.sql`" vs. reglas puras testeables                                                               | El preset vive en el dominio (`presets/`) con pruebas; el seed lo carga en la base            | CLAUDE v2                     |
| C-05 | "Sin spec aprobado no se implementa" con `specs/` vacío vs. pedido de desarrollo íntegro                                                | El inventario por ID es el spec de alcance; `/spec <ID>` prepara cada pieza                   | CLAUDE v2, `.claude/commands` |
| C-06 | Reglamento "único para toda la temporada" (plan §3) vs. "ajustar el reglamento del evento" (OR-04)                                      | La temporada versiona su reglamento (SA-07); cada evento guarda su copia y su versión (TR-11) | ADR-0006                      |
| C-07 | PDFs guardados en bucket con URL firmada (ADR-0013) vs. documento siempre al día y RLS como autorización                                | PDF a demanda, leído con el cliente del usuario; versiones inmutables en la base              | ADR-0013 (act.)               |
| C-08 | "Orden del día exportable en PDF/CSV" (OR-40) vs. costo de mantener otra plantilla de PDF                                               | Página imprimible en el idioma de la ruta (el navegador guarda PDF)                           | ADR-0013 (act.)               |
| C-09 | Rate limit "Supabase Auth + proxy" (TR-34) vs. reservas públicas sin cuenta                                                             | Auth nativo para login; limitador en Postgres por HMAC de IP y por email para reservas        | ADR-0014                      |
| C-10 | Actores del plan: "Super Admin (organizador)" vs. organizadores por evento aislados                                                     | Super Admin de la instancia + rol `ORGANIZADOR_EVENTO` por evento con RLS                     | ADR-0007                      |
| C-11 | Datos adicionales en el trigger que devuelve la ficha a borrador vs. no intervienen en el reglamento                                    | Editarlos no reinicia la validación; los obligatorios se exigen al enviar la ficha            | Migración 0300                |
| C-12 | Hotel "primeros 400 inscriptos" (Bases) vs. "orden de inscripción y primer pago" (plan)                                                 | Criterio configurable por hotel; por defecto primer pago (supuesto S-08)                      | `docs/PENDIENTES.md` N-04     |
| C-13 | UI con shadcn/ui (CLAUDE v1) vs. control fino de accesibilidad y cero dependencias de copia                                             | Paquete propio `@soed/ui` (Tailwind 4) verificado con axe                                     | CLAUDE v2                     |

## 4. Riesgos y mitigación

| ID   | Riesgo                                                  | Prob.                      | Impacto | Mitigación                                                                                                                    |
| ---- | ------------------------------------------------------- | -------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| R-01 | Uso indebido de `service_role`                          | Baja                       | Alto    | Regla ESLint que lo limita a infraestructura y API; usos documentados; pgTAP de RLS por rol                                   |
| R-02 | Datos de menores (LGPD)                                 | Media                      | Alto    | Documentos opcionales y restringidos; anon sin acceso a tablas; RPC públicas sin datos personales; auditoría de exportaciones |
| R-03 | Sincronización offline con conflictos                   | Media                      | Medio   | Idempotencia por `client_uuid`; el servidor revalida con los mismos casos de uso; estado de cola visible                      |
| R-04 | Realtime caído en el evento                             | Media                      | Medio   | Sondeo de respaldo en `EnVivo`; las vistas funcionan sin Realtime                                                             |
| R-05 | Cron de emails en plan Hobby                            | Alta si no se contrata Pro | Medio   | Documentado (P-04); en Hobby corre diario                                                                                     |
| R-06 | CSP con `'unsafe-inline'`                               | Media                      | Medio   | Resto de cabeceras estrictas; migración a nonce planificada                                                                   |
| R-07 | Login con magic link sin e2e (depende de Supabase Auth) | Baja                       | Medio   | Cookie de sesión real en e2e; verificación manual en el runbook de alta                                                       |
| R-08 | Inventario reconstruido difiere del original            | Media                      | Medio   | Validación pendiente (N-01); IDs estables permiten re-mapear                                                                  |
| R-09 | ZIP grande en celulares con poca memoria                | Media                      | Bajo    | ZIP por bloque (no por evento); descarga individual siempre disponible                                                        |
| R-10 | Entregabilidad de emails                                | Media                      | Medio   | SPF, DKIM, DMARC antes de `EMAIL_MODO=resend`; reintentos acotados                                                            |
| R-11 | Ráfagas en el borde de la ventana del limitador         | Baja                       | Bajo    | Límites por origen y por email; campo trampa; cupo bloqueante                                                                 |
| R-12 | Supuestos del preset 2026 sin confirmar                 | Alta                       | Medio   | Listados en `reglamento.supuestos`; el organizador puede ajustar y revalidar (N-02)                                           |

## 5. Brechas remanentes (23 sin prueba propia)

| Tipo                                                | IDs                                                                                                                                                                                                                | Tratamiento                                                                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dependen de servicios externos no disponibles en CI | PR-01, JU-01 (login y magic link de Supabase Auth); PR-24, JU-10, OP-16, TR-46 (Realtime)                                                                                                                          | Verificación manual en staging según el runbook de alta; las vistas en vivo tienen sondeo de respaldo probado                                    |
| Proceso e infraestructura                           | TR-24, TR-32, TR-40, TR-41, TR-42, TR-43, TR-48, TR-49, TR-50                                                                                                                                                      | Se cumplen con CI (`i18n:check`, regla ESLint de `service_role`), runbooks y `.claude/commands`; TR-41 y TR-43 se activan al crear los proyectos |
| Arquitectura reemplazada                            | TR-45                                                                                                                                                                                                              | Superada por ADR-0014                                                                                                                            |
| Fuera de alcance u opcional                         | TR-26, TR-51, TR-52                                                                                                                                                                                                | `docs/PENDIENTES.md` (mejoras planificadas)                                                                                                      |
| Requieren definición de producto                    | PR-02 (idioma guardado en el perfil), JU-09 (idioma del jurado), OP-04 (cierre de bloque por el director técnico), TR-25 (idioma nuevo sin tocar pantallas: soportado por diseño, sin prueba con un tercer idioma) | Se resuelven con el negocio antes del piloto                                                                                                     |

## 6. Decisiones de esta revisión

- CLAUDE.md v2 en la raíz; v1 archivada en `docs/historial/`.
- ADR-0013 actualizado y ADR-0014 nuevo.
- Plan de desarrollo v2 con estado por etapa en `docs/PLAN_DESARROLLO.md`.
- `architecture/DATABASE_SCHEMA.md` generado desde las migraciones y verificado en CI.
