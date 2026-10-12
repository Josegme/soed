# Runbook · Alta de un cliente (instancia nueva)

Objetivo: una organización nueva con su propia instancia aislada (ADR-0003) en menos de un día hábil. Responsable técnico: quien opera SOED. Responsable del cliente: quien provee marca, dominio y datos legales.

> Cada paso con costo o irreversible (crear proyectos de pago, comprar dominios, cambiar DNS, enviar emails reales) requiere aprobación explícita del responsable comercial antes de ejecutarse.

## 0. Datos que hay que pedir al cliente

| Dato                                                           | Para qué                 | Dónde termina                                                      |
| -------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------ |
| Nombre, nombre corto y descripción (es/pt-BR)                  | Marca, metadatos, emails | `clients/<slug>/client.config.ts`                                  |
| Logo y favicon en SVG; color de marca                          | Tema y PWA               | `clients/<slug>/assets`, `theme.css`                               |
| Dominio (p. ej. `inscripciones.cliente.com`)                   | Sitio, emails, QR        | Vercel + DNS + Resend                                              |
| Idiomas y zona horaria por defecto                             | i18n                     | `client.config.ts`                                                 |
| Módulos contratados (clases, entradas, hoteles, acreditación…) | Feature flags (TR-39)    | `client.config.ts` → `modulos`                                     |
| Razón social, email legal, términos y privacidad (es/pt-BR)    | Páginas legales          | `client.config.ts` → `legal`                                       |
| Remitente de emails                                            | Resend                   | `client.config.ts` → `email`                                       |
| Reglamento de la temporada (Bases)                             | Preset                   | `packages/domain/src/reglamento/presets/` si difiere del existente |

## 1. Configuración en el repositorio (sin costo)

1. `/nuevo-cliente <slug>` o copiar `clients/_template` a `clients/<slug>`.
2. Completar `client.config.ts`; el build falla si falta algo (validación Zod, TR-37).
3. Reemplazar assets y ajustar `theme.css`; `pnpm contraste` debe pasar AA.
4. Si el reglamento difiere del preset, crear un preset nuevo (archivo + entrada en `presets/index.ts`) con sus pruebas de dominio.
5. Agregar el slug a la matriz `build` de `.github/workflows/ci.yml`.
6. Verificar: `SOED_CLIENT=<slug> pnpm --filter @soed/web cliente && pnpm --filter @soed/web build`.
7. PR con el alta; merge solo con CI en verde.

## 2. Supabase (requiere aprobación: crea un proyecto)

1. Crear el proyecto en la organización de Supabase acordada, **región más cercana a la mayoría de usuarios** (para Brasil y Argentina: `sa-east-1`, São Paulo).
2. Auth → Providers: email con magic link y contraseña; Google si el cliente lo pide. URL del sitio y redirect: `https://<dominio>/auth/callback`.
3. Auth → Rate limits: dejar los valores por defecto o más estrictos (TR-34).
4. Aplicar migraciones en orden desde `supabase/migrations/` con la CLI (`supabase link` + `supabase db push`) — nunca editar el esquema desde el panel.
5. Cargar `clients/<slug>/seed.sql` (reglamento preset, catálogos).
6. Storage: verificar buckets privados `musica` y `publico` creados por la migración 0800.
7. Crear el primer Super Admin por canal privilegiado (SA-13): SQL con la clave de servidor, `insert into rol_global (usuario_id, rol) values (…, 'SUPER_ADMIN')`.
8. Activar backups (PITR en plan Pro) y documentar la política de retención (TR-49).

## 3. Resend (requiere aprobación: verifica un dominio)

1. Agregar el dominio del remitente y crear los registros SPF, DKIM y DMARC que indique Resend.
2. Crear una API key de envío solo para ese dominio.
3. Mientras el dominio no esté verificado, la instancia queda en `EMAIL_MODO=sink`.

## 4. Vercel (requiere aprobación: crea un proyecto)

1. Proyecto nuevo desde el repositorio, raíz `apps/web`, framework Next.js.
2. Variables por entorno (Production / Preview), **solo en Vercel**:
   - `SOED_CLIENT=<slug>`, `NEXT_PUBLIC_SITE_URL=https://<dominio>`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
   - `EMAIL_MODO=resend` (solo Production), `RESEND_API_KEY`
   - `CRON_SECRET` (`openssl rand -hex 32`), `ORIGEN_HMAC_SECRETO` (`openssl rand -hex 32`)
3. Previews apuntan a un Supabase de staging, nunca a producción (TR-43).
4. Crons de `apps/web/vercel.json`: emails cada 5 min requiere plan Pro; en Hobby, cambiar a diario y avisar al cliente.
5. Dominio: agregarlo al proyecto y crear el CNAME/A que indique Vercel (cambio de DNS: aprobación).

## 5. Verificación de salida

- [ ] `/es` y `/pt` cargan con la marca; `/sitemap.xml` y `/robots.txt` responden; `/manifest.webmanifest` con el color del cliente.
- [ ] Login del Super Admin; crear temporada y un evento de prueba en borrador.
- [ ] Un email de prueba al equipo interno (nunca a terceros) llega con SPF/DKIM correctos.
- [ ] Crons: `GET /api/cron/emails` con `Authorization: Bearer <CRON_SECRET>` responde 200; sin header, 401.
- [ ] Borrar el evento de prueba.
