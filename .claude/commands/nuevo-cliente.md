---
description: Dar de alta una instancia nueva de SOED para un cliente
argument-hint: <slug-del-cliente>
---

Seguí `docs/runbooks/ALTA_CLIENTE.md` para el cliente `$ARGUMENTS`. Hacé solo lo local y sin costo:

1. Copiá `clients/_template/` a `clients/$ARGUMENTS/` y completá `client.config.ts` con lo que el usuario provea (nombre, dominio, idiomas, zona horaria, módulos, remitente de email, marca, datos legales). Lo que falte queda como `PENDIENTE:` y se lista al final.
2. Reemplazá `assets/logo.svg` y `assets/favicon.svg` si te los pasan; ajustá `theme.css` y corré `pnpm contraste` (AA).
3. Verificá con `SOED_CLIENT=$ARGUMENTS pnpm --filter @soed/web cliente && pnpm --filter @soed/web build`.
4. No crees proyectos en Supabase ni en Vercel, no compres dominios ni cambies DNS, no cargues secretos: listá esos pasos como pendientes con el responsable, según el runbook.
