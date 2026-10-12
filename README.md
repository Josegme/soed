# SOED

Plataforma web para organizaciones de eventos competitivos de danza: temporadas con selectivos y final, inscripciones validadas contra el reglamento, liquidaciones y cobro manual, orden de salida en vivo, planillas de jurado con resultados publicados según el Art. 32, acreditación con QR, clases, entradas y hoteles. Español y portugués de Brasil. **Una instancia aislada por cliente** (ADR-0003).

> SOED es el sistema; el evento es un dato. Lo que varía entre organizaciones (marca, reglamento, módulos, textos) es configuración, nunca `if (cliente === 'x')`.

## Estado

| Área                          | Estado                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventario de funcionalidades | 207 ítems en [`docs/auditoria/inventario.csv`](docs/auditoria/inventario.csv); trazabilidad en [`MATRIZ_TRAZABILIDAD.md`](docs/auditoria/MATRIZ_TRAZABILIDAD.md) (`pnpm trace`) |
| Base de datos                 | 8 migraciones con RLS en todas las tablas; pruebas pgTAP por rol (`pnpm db:test`)                                                                                               |
| Aplicación                    | Super Admin, organizador, academia, jurado, coordinador, locutor, DJ, director técnico, acreditación y caja; sitio público `/es` y `/pt`                                        |
| Pruebas                       | Unitarias (dominio y web), integración contra PostgREST real, e2e de sitio público y de panel con WCAG 2.2 AA (axe)                                                             |
| Infraestructura               | Pendiente de credenciales del cliente: ver [`docs/runbooks/`](docs/runbooks) y [`docs/PENDIENTES.md`](docs/PENDIENTES.md)                                                       |

## Stack

Next.js 16 (App Router, Server Actions) + TypeScript estricto · Supabase (Postgres, Auth, Storage, Realtime) · next-intl · Zod · Tailwind 4 · react-pdf · Resend · Vitest · Playwright + axe · pnpm + Turborepo · GitHub Actions · Vercel.

Descartados por decisión (ADR-0002): NestJS, Prisma, Redis, Socket.io, BullMQ, S3.

## Inicio rápido

```bash
pnpm install
cp .env.example apps/web/.env.local   # completar con un Supabase propio (nunca commitear)
pnpm dev                              # http://localhost:3000/es
```

Sin variables de Supabase, el sitio público funciona con datos vacíos y el panel informa que falta configuración.

## Comandos

| Comando                                              | Qué hace                                                                               |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `pnpm lint` · `pnpm typecheck` · `pnpm format:check` | Calidad estática                                                                       |
| `pnpm test`                                          | Unitarias de dominio, tipos compartidos y web                                          |
| `pnpm i18n:check`                                    | Claves `es` y `pt-BR` completas y sin sobrantes                                        |
| `pnpm db:test`                                       | Migraciones desde cero + pgTAP (RLS por rol, reglas de datos) en un PostgreSQL efímero |
| `pnpm db:types`                                      | Regenera `packages/shared-types/src/database.types.ts` desde las migraciones           |
| `pnpm test:integracion`                              | supabase-js contra PostgREST real                                                      |
| `pnpm test:e2e`                                      | E2E del sitio público                                                                  |
| `pnpm test:e2e:panel`                                | E2E del panel autenticado (PostgreSQL + PostgREST + build)                             |
| `pnpm trace`                                         | Regenera la matriz de trazabilidad desde las etiquetas `[ID]` de las pruebas           |

## Estructura

```
apps/web/src/
  app/                 rutas (público, panel, API, crons)
  modules/<modulo>/    application (casos de uso) · infrastructure (Supabase) · interface (acciones y UI)
  lib/                 utilidades transversales (i18n, sesión, formularios, CSV, ZIP, PWA)
packages/
  domain/              reglas puras: reglamento, liquidación, cobros, orden, puntajes, pases, hoteles
  shared-types/        schemas Zod del borde, client.config, tipos de la base
  ui/                  componentes accesibles
  email-templates/     emails transaccionales
supabase/migrations/   SQL a mano, RLS en la misma migración
supabase/tests/        pgTAP, fixture de integración y de e2e
clients/<slug>/        configuración, tema y assets de cada instancia
architecture/          ARQUITECTURA, DATABASE_SCHEMA y ADR
docs/                  plan, auditoría, runbooks, glosario, informes
```

## Documentación

- [`CLAUDE.md`](CLAUDE.md): reglas de trabajo para agentes y personas.
- [`docs/PLAN_DESARROLLO.md`](docs/PLAN_DESARROLLO.md): plan vigente por etapas.
- [`architecture/ARQUITECTURA.md`](architecture/ARQUITECTURA.md) y [`architecture/DATABASE_SCHEMA.md`](architecture/DATABASE_SCHEMA.md).
- [`architecture/decisions/`](architecture/decisions): ADR-0001 a ADR-0014.
- [`docs/auditoria/AUDITORIA_2026-10-02.md`](docs/auditoria/AUDITORIA_2026-10-02.md): brechas, contradicciones y riesgos.
- [`docs/runbooks/`](docs/runbooks): alta de cliente y despliegue por instancia.
- [`docs/INFORME_CALIDAD.md`](docs/INFORME_CALIDAD.md): resultados de pruebas, accesibilidad, seguridad y rendimiento.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): flujo de trabajo y Definition of Done.
