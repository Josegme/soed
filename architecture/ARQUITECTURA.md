# Arquitectura de SOED

Versión 2 · 02/10/2026. Complementa los ADR de `architecture/decisions/` (el "por qué"); este documento describe el "cómo" vigente.

## 1. Vista general

```
Navegador (es / pt-BR, PWA)
  │  Server Components · Server Actions · Route Handlers      ← Next.js 16 en Vercel
  │  IndexedDB outbox (jurado, caja) → /api/sync
  ▼
apps/web/src/modules/<modulo>
  interface       acciones ('use server'), componentes, route handlers
  application     casos de uso puros + puertos (interfaces)
  infrastructure  adaptadores Supabase (cliente del usuario; service role solo aquí)
  ▼
packages/domain   reglas sin dependencias: reglamento, liquidación, cobros, orden, puntajes, pases, hoteles, acreditación
  ▼
Supabase por instancia: Postgres (RLS en todas las tablas) · Auth · Storage privado · Realtime
Vercel Cron → /api/cron/emails, /api/cron/recordatorios → Resend
```

Una instancia = un proyecto Supabase + un proyecto Vercel + un dominio, con el mismo código y su `clients/<slug>` (ADR-0003).

## 2. Capas y reglas de dependencia

| Capa                       | Puede importar                                   | No puede                       |
| -------------------------- | ------------------------------------------------ | ------------------------------ |
| `packages/domain`          | nada externo                                     | Next, Supabase, Zod            |
| `modules/*/application`    | dominio, tipos compartidos                       | Supabase, Next                 |
| `modules/*/infrastructure` | Supabase (cliente del usuario o `supabaseAdmin`) | UI                             |
| `modules/*/interface`      | casos de uso, consultas de infraestructura, UI   | `supabaseAdmin` (regla ESLint) |

- Los casos de uso devuelven `Result<T, ErrorDominio>`; las acciones traducen a `EstadoFormulario` con códigos de `messages`.
- Las lecturas de pantallas son consultas de infraestructura con el cliente del usuario: la **RLS es la autorización**; la UI solo esconde lo que de todos modos la base negaría.
- `service_role` se usa para: columnas derivadas (validación de fichas, liquidaciones versionadas), auditoría de exportaciones, colas de email, reservas públicas y cálculos que necesitan datos que el usuario no puede ver (prioridad de hotel), siempre después de verificar el permiso.

## 3. Módulos

| Módulo                              | Responsabilidad                                                                             | IDs principales                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `identidad`                         | sesión, perfiles, permisos por evento                                                       | PR-01, TR-16, TR-36                          |
| `eventos`                           | temporadas, eventos, ciclo de vida, configuración, equipo, campos adicionales, acreditación | SA-01..08, OR-01..18                         |
| `temporadas`                        | tablero, historial, exportación y reglamento versionado de la temporada                     | SA-07, SA-10, SA-11, SA-15, SA-18            |
| `academias`                         | academia, profesores, bailarines, coreografías, inscripción                                 | PR-03..11                                    |
| `inscripciones`                     | fichas, validación contra el reglamento, gestión del organizador, datos adicionales         | PR-12..21, OR-19..25                         |
| `liquidaciones` · `cobros`          | cálculo, versiones, PDF, cobro manual offline, caja                                         | OR-26..34, PR-13..17, OP-19..21              |
| `orden` · `vivo`                    | orden de salida, publicación, operación en vivo por rol, ZIP de música                      | OR-35..40, OP-05..16                         |
| `puntajes` · `premios` · `pases`    | planillas, ranking, publicación (Art. 32), premios, pases manuales                          | JU-*, OR-41..43, OP-01..04                   |
| `documentos`                        | certificados bilingües                                                                      | OR-44, PR-32                                 |
| `acreditacion`                      | credenciales con QR, escaneo, mesa                                                          | OP-17..25                                    |
| `hoteles` · `actividades`           | hoteles con prioridad; clases y entradas con reservas                                       | OR-09, OR-51..54, PU-09, PU-10, PR-30, PR-31 |
| `comunicaciones` · `notificaciones` | comunicados y emails transaccionales encolados                                              | OR-47..50, PR-22, PR-33                      |
| `sincronizacion`                    | despacho de la cola offline a los mismos casos de uso                                       | JU-05, OP-21                                 |
| `gestion`                           | contexto y consultas del panel del organizador                                              | OR-45                                        |

## 4. Autorización

1. **Sesión** (`lib/auth/sesion.ts`): usuario, roles globales y, por evento, roles y permisos efectivos (`evento_miembro` × `rol_permiso`).
2. **UI**: `tienePermiso(sesion, eventoId, permiso)` decide pestañas y acciones; `SECCIONES_GESTION` declara permiso y módulo de cada sección.
3. **Base**: políticas por evento con `private.eventos_con_permiso(permiso)`, `private.academias_del_usuario()`, `private.es_super_admin()`; triggers de guarda para columnas reservadas, transiciones y archivado.
4. **Público (anon)**: sin acceso a tablas salvo columnas explícitas de `evento`; todo lo demás por RPC `security definer` sin datos personales (`publico_orden`, `publico_resultados`, `publico_cronograma`, `publico_clases`, `publico_entradas`).

Roles nuevos = filas en `rol` y `rol_permiso`, sin código (ADR-0007).

## 5. Flujos clave

- **Ficha** (PR-12): la academia edita → trigger vuelve a borrador si cambian datos de reglamento → `enviarFicha` valida con el dominio y exige campos adicionales obligatorios → servidor escribe la validación (service role) → estado `ENVIADA`.
- **Liquidación** (TR-18): cálculo puro en dominio → versión inmutable con número `LIQ-<SLUG>-0001` (contador atómico) y token QR → PDF a demanda → cobros manuales con `client_uuid` idempotente; el saldo es una vista.
- **Orden en vivo** (OP-05..08): transiciones de dominio → `orden_item` en la publicación Realtime → `EnVivo` refresca cada vista (con sondeo de respaldo) → páginas públicas revalidadas.
- **Puntajes** (JU-02..08, OR-41): planilla offline en IndexedDB → `/api/sync` → envío → ranking calculado por el organizador → publicación que habilita notas, devoluciones, resultados públicos y certificados.
- **Reservas públicas** (PU-09, PU-10): formulario con campo trampa → servidor arma HMAC de la IP → RPC con límite de frecuencia, publicación y cupo bloqueante → email con código.

## 6. Offline, tiempo real y PWA

- **Offline** (ADR-0010): cola IndexedDB por usuario (`lib/offline/outbox.ts`) con idempotencia por `client_uuid`; `/api/sync` despacha a los mismos casos de uso.
- **Tiempo real** (ADR-0012): `orden_item` y `planilla` en `supabase_realtime`; RLS aplica a los eventos de Realtime.
- **PWA** (ADR-0014): manifest por instancia; service worker que solo cachea estáticos con hash y la página sin conexión de cada idioma.

## 7. Internacionalización

`next-intl` con rutas `/es` y `/pt` (ADR-0005). Mensajes tipados en `apps/web/messages/{es,pt-BR}.json`; un idioma nuevo = código en `IDIOMAS`, archivo de mensajes y prefijo en `lib/i18n/locales.ts`. Contenido del organizador en `jsonb` traducible con vista de traducciones pendientes.

## 8. Documentos, emails y tareas programadas

Ver ADR-0013 (actualizado) y ADR-0014: PDF a demanda con react-pdf, CSV con BOM y neutralización de fórmulas, emails encolados en `email_envio` y enviados por Vercel Cron con Resend (`SIMULADO` fuera de producción), ZIP de música armado en el navegador.

## 9. Calidad

| Nivel        | Herramienta                          | Qué cubre                                                  |
| ------------ | ------------------------------------ | ---------------------------------------------------------- |
| Dominio      | Vitest (cobertura mínima 90 % en CI) | reglas del reglamento, liquidación, orden, puntajes        |
| Base         | pgTAP sobre PostgreSQL efímero       | RLS por rol, guardas, cupos, límites, índices de FK        |
| Integración  | supabase-js contra PostgREST real    | adaptadores y RPC con JWT por rol                          |
| E2E          | Playwright + axe (WCAG 2.2 AA)       | sitio público y panel por rol, offline, PDF, CSV, ZIP, PWA |
| Trazabilidad | `pnpm trace`                         | IDs del inventario ↔ pruebas                               |
