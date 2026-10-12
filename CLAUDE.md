# SOED — Instrucciones para Claude Code

Plataforma web para organizaciones de eventos de danza: temporadas con selectivos y final, inscripciones, música, orden de salida en vivo, puntajes de jurado, acreditación, clases, entradas y hoteles. Español y portugués de Brasil. Una instancia aislada por cliente.

> Versión 2 (02/10/2026). La v1 está en `docs/historial/CLAUDE_v1_2026-09-30.md`; los cambios se explican en `docs/auditoria/AUDITORIA_2026-10-02.md`.

## Fuentes de verdad (leer antes de trabajar)

1. `docs/PLAN_DESARROLLO.md` — plan vigente. Si un documento lo contradice, gana el plan.
2. `architecture/decisions/` — ADR-0001 a ADR-0014. No contradecirlos; si algo cambia, se crea un ADR nuevo.
3. `docs/GLOSARIO.md` — vocabulario único en código, UI y commits.
4. `docs/auditoria/inventario.csv` — cada funcionalidad con su ID (`OR-16`, `PU-07`…), módulo, tablas y prueba esperada. Es el spec de alcance: una funcionalidad nueva entra primero aquí.
5. `architecture/ARQUITECTURA.md` y `architecture/DATABASE_SCHEMA.md` — capas y modelo de datos.

## Stack

Next.js 16 (App Router, Server Actions, Route Handlers) + TypeScript estricto en Vercel · Supabase (Postgres, Auth, Storage, Realtime) · Zod · next-intl (`es`, `pt-BR`) · Resend · react-pdf · Tailwind 4 · Vitest + Playwright + axe · pnpm + Turborepo · GitHub Actions.

No usar NestJS, Prisma, Redis, Socket.io, BullMQ ni S3 (ADR-0002). Colas y límites de frecuencia viven en Postgres; tareas programadas en Vercel Cron (ADR-0013, ADR-0014).

## Estructura

```
apps/web/src/app                 rutas: (publico), (panel), api, sw.js, sitemap, robots, manifest
apps/web/src/modules/<modulo>/   application (casos de uso + puertos) · infrastructure (Supabase) · interface (acciones, UI)
apps/web/src/lib                 i18n, sesión, formularios, CSV, ZIP, PWA, módulos, origen
packages/{domain,shared-types,ui,email-templates}
supabase/{migrations,tests/database,tests/integracion,tests/e2e}
clients/<slug>/{client.config.ts,theme.css,assets,seed.sql}
architecture/  docs/  .claude/{commands,skills}
```

## Reglas de arquitectura (no negociables)

- **Clean Architecture:** `domain` no importa nada externo. `application` define casos de uso y puertos. `infrastructure` los implementa con Supabase. `interface` (server actions, route handlers, componentes) solo llama casos de uso o consultas de infraestructura.
- **Result Pattern:** los casos de uso devuelven `Result<T, E>`; no lanzan excepciones por errores de negocio. Las acciones devuelven `EstadoFormulario` con códigos traducibles.
- **Single-tenant:** ninguna tabla lleva `tenant_id`. Prohibido `if (cliente === 'x')`: la variación es un parámetro de `client.config.ts` (con ADR) y los módulos se consultan con `moduloOn()` / `exigirModulo()` (ADR-0003, TR-39).
- **Eventos independientes:** toda tabla con datos de evento lleva `evento_id` indexado y RLS por evento; roles por evento en `evento_miembro` y permisos en `rol_permiso` (ADR-0004, ADR-0007).
- **El pago nunca limita la participación.** Se calcula la liquidación y el organizador registra cobros a mano. Ningún estado de pago bloquea inscripción, acreditación ni presentación. Sin cobro en línea.
- **Pases a la final son manuales.** El sistema registra quién, cuándo y por qué; no decide.
- **Art. 32:** notas, devoluciones, ranking y certificados solo son visibles para academias y público después de publicar resultados (RLS + RPC públicas).
- **Reglamento configurable:** categorías, tolerancias (30 % en grupos), tiempos (30 s grupos, 15 s solo/dúo/trío), géneros y bandas (9,0 / 8,0 / 7,0) viven en `ReglamentoEvento`. Presets en `packages/domain/src/reglamento/presets/`. La temporada versiona su reglamento; cada evento guarda su copia.
- **i18n:** ningún texto visible en literal (ESLint `jsx-no-literals`); todo es clave de `apps/web/messages/{es,pt-BR}.json` con tipos estrictos. Contenido del organizador en `jsonb {es, pt-BR}`. `pnpm i18n:check` falla si falta una clave.
- **Seguridad:** toda tabla nueva con RLS en la misma migración; `service_role` solo en `modules/**/infrastructure`, `lib/supabase/admin.ts`, `app/api` y pruebas (regla ESLint); sin secretos en el repo; buckets privados con URLs firmadas; entradas validadas con Zod en el borde; endpoints públicos con límite de frecuencia en Postgres (HMAC de IP, nunca la IP).
- **Base de datos:** migraciones SQL a mano; índice en toda clave foránea (pgTAP lo verifica); políticas con `(select auth.uid())`; funciones auxiliares en `private`; RPC públicas `security definer` con `search_path = ''` y sin datos personales. Nunca editar el esquema desde el panel de Supabase.

## Flujo de trabajo

1. Rama desde la principal (`feat/<id>-<tema>`); en sesiones de agente, la rama asignada.
2. `/spec <ID>`: leer el ítem del inventario, listar supuestos y preguntas, proponer plan.
3. Implementar por capas: migración + RLS + pgTAP → dominio (con tests) → casos de uso → interfaz → UI en `es` y `pt-BR`.
4. Etiquetar cada prueba con sus IDs (`[OR-16]`) solo si realmente los ejercita; `pnpm trace` regenera la matriz.
5. Antes de cada commit: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm i18n:check`; si tocaste la base, `pnpm db:test && pnpm db:types`; si tocaste pantallas, `pnpm test:e2e:panel`.
6. `/review`: revisión propia contra el ítem, estas reglas y la checklist de seguridad.

## Comandos

```
pnpm dev                         # desarrollo
pnpm lint | typecheck | test | format:check | i18n:check | contraste
pnpm db:test | db:types          # PostgreSQL efímero + pgTAP | tipos desde las migraciones
pnpm test:integracion            # supabase-js contra PostgREST real
pnpm test:e2e | test:e2e:panel   # sitio público | panel autenticado con axe
pnpm trace                       # matriz de trazabilidad
```

## Permisos y límites

- **Sin preguntar:** leer, editar archivos, tests, lint, typecheck, Supabase local, migraciones locales, crear ramas y commits.
- **Pedir aprobación:** `git push`, abrir o fusionar PR, aplicar migraciones a staging o producción, cambiar variables de entorno o DNS, instalar dependencias nuevas, borrar datos.
- **Nunca:** actuar sobre producción sin aprobación explícita, imprimir o commitear secretos, desactivar RLS, usar `--no-verify`, push forzado.
- Secretos solo en Vercel y `.env.local`. Ver `.env.example`.

## Commits y PRs

Conventional Commits (`feat(inscripciones): ...`). Un PR por ítem o grupo coherente. Cada PR lista los IDs que cubre y marca la Definition of Done de `CONTRIBUTING.md`.

## Cuando falte información

No inventar reglas de negocio. Marcar el supuesto en `docs/PENDIENTES.md` o en la auditoría y seguir con lo que no depende de él.
