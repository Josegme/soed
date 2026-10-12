# Runbook · Despliegue por instancia

## Principios

- Un solo código base; cada instancia despliega el mismo commit con su `SOED_CLIENT`.
- Producción solo con aprobación explícita. Migraciones primero, aplicación después.
- Migraciones aditivas: nunca `drop` ni cambios destructivos con un evento `EN_CURSO` (TR-41).

## Flujo normal

1. PR con CI en verde (lint, tipos, i18n, contraste, unitarias, pgTAP, tipos de base al día, integración PostgREST, build por cliente, e2e público y de panel con axe).
2. Merge a la rama principal → Vercel construye un preview por instancia contra staging.
3. **Staging**: `supabase db push` con las migraciones nuevas sobre el proyecto de staging; smoke test del preview.
4. **Producción** (aprobación): para cada instancia, en este orden:
   1. Verificar que ningún evento esté `EN_CURSO` si la migración no es puramente aditiva.
   2. Backup manual (o confirmar PITR).
   3. `supabase db push` sobre el proyecto de la instancia.
   4. Promover el deploy en Vercel.
   5. Smoke test: sitio público, login, panel del evento activo, un PDF de liquidación.

## Rollback

- Aplicación: "Instant Rollback" de Vercel al deploy anterior.
- Base: las migraciones son aditivas; si una falla a mitad, `supabase db push` es transaccional por archivo. Ante un problema de datos, restaurar con PITR al instante previo y avisar a los organizadores con eventos activos.

## Secretos

- Rotación: `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `CRON_SECRET` y `ORIGEN_HMAC_SECRETO` se rotan desde sus paneles y se actualizan en Vercel; luego redeploy. Rotar `ORIGEN_HMAC_SECRETO` reinicia los contadores del límite de frecuencia (efecto aceptable).
- Nunca se imprimen en logs, PRs ni chats.
