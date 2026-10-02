# ADR-0002 · Next.js full-stack en Vercel + Supabase como backend gestionado

- Estado: Aceptada
- Fecha: 2026-10-02
- Reemplaza: el stack del paquete original (NestJS, Prisma, Redis, Socket.io, S3, BullMQ)

## Contexto

El paquete de specs original asumía un servidor propio con NestJS, Redis, Socket.io, S3 y BullMQ. Vercel es serverless: no mantiene WebSockets persistentes ni procesos en segundo plano. Cada cliente necesita su instancia aislada a un costo operativo bajo.

## Decisión

| Pieza         | Elección                                                                                     |
| ------------- | -------------------------------------------------------------------------------------------- |
| UI + API      | Next.js 16 (App Router, Server Components, Server Actions, Route Handlers) en Vercel         |
| Datos         | Supabase Postgres con migraciones SQL versionadas a mano                                     |
| Autorización  | RLS en Postgres + verificación de permisos en casos de uso (defensa en profundidad)          |
| Auth          | Supabase Auth (email y contraseña, Google, magic link) con `@supabase/ssr`                   |
| Tiempo real   | Supabase Realtime (Postgres Changes + Broadcast), ver ADR-0012                               |
| Archivos      | Supabase Storage con buckets privados y URLs firmadas                                        |
| Tareas largas | Supabase Queues (pgmq) + pg_cron + Edge Functions                                            |
| Email         | Resend + React Email                                                                         |
| Validación    | Zod 4 en el borde                                                                            |
| Monorepo      | pnpm + Turborepo: una app `web` y paquetes `domain`, `shared-types`, `ui`, `email-templates` |
| Tests         | Vitest (unitarios), pgTAP (SQL y RLS), Playwright + axe-core (e2e y accesibilidad)           |

**Versión de Next.js.** El plan original fijaba Next.js 15. Al 2026-10-02 la línea estable es 16.x y la 15 quedó en la etiqueta `backport` (solo parches de seguridad). Para un producto que vivirá varios años se adopta **Next.js 16**. Impacto: el middleware pasa a `proxy.ts`, `params` es asíncrono y `next lint` se reemplaza por ESLint directo. Ningún cambio afecta a otros ADRs.

**TypeScript.** Se fija 6.0.x porque `typescript-eslint` todavía no soporta TypeScript 7 (compilador nativo). Se revisa al publicarse el soporte.

## Alternativas

| Opción                               | Pros                                                                               | Contras                                                                 | Veredicto   |
| ------------------------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------- |
| NestJS + Prisma en VPS               | Control total                                                                      | Operar N servidores, WebSockets y colas propias; costo por cliente alto | Descartada  |
| Next.js + API separada en Fly/Render | Procesos largos nativos                                                            | Dos deploys por cliente y CORS                                          | Descartada  |
| **Next.js en Vercel + Supabase**     | Un deploy por cliente; RLS, Realtime, Storage y colas gestionados; tipos generados | Dependencia de dos proveedores; límites de Realtime por plan            | **Elegida** |

## Consecuencias

- Prohibido introducir NestJS, Prisma, Redis, Socket.io, BullMQ o S3 (regla en `CLAUDE.md`).
- Ninguna tarea de más de ~10 s corre en un Route Handler: va a pgmq + Edge Function.
- La `service_role` solo se usa en módulos `server-only` y en Edge Functions.
