# Contribuir a SOED

## Flujo

1. Elegí uno o más IDs del inventario (`docs/auditoria/inventario.csv`). Si la funcionalidad no está, agregala primero con su módulo, tablas y prueba esperada.
2. Rama desde la principal: `feat/<ID>-<tema>` (o `fix/…`, `docs/…`).
3. Implementá por capas: migración + RLS + pgTAP → dominio con tests → casos de uso → interfaz → UI en `es` y `pt-BR`.
4. Etiquetá cada prueba con los IDs que **realmente** ejercita (`test('[OR-16] …')`) y corré `pnpm trace`.
5. Commits con Conventional Commits; PR con los IDs cubiertos y esta Definition of Done.

## Definition of Done

- [ ] `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm i18n:check` en verde.
- [ ] Tablas nuevas con RLS en la misma migración, índice en cada FK y pgTAP por rol (`pnpm db:test`); `pnpm db:types` sin diferencias.
- [ ] Sin texto literal en la UI; mensajes en `es` y `pt-BR` con el vocabulario de `docs/GLOSARIO.md`.
- [ ] Ningún estado de pago bloquea inscripción, acreditación ni presentación; ningún pase automático; resultados solo tras publicar (Art. 32).
- [ ] Entradas validadas con Zod en el borde; `service_role` solo donde lo permite la regla de ESLint; sin secretos en el repo.
- [ ] Pantallas nuevas con e2e y verificación axe WCAG 2.2 AA (`pnpm test:e2e:panel` o `pnpm test:e2e`).
- [ ] Si cambia una decisión, ADR nuevo o actualización del ADR afectado.
- [ ] Sin `if (cliente === 'x')`: la variación es configuración o módulo.

## Convenciones

- Código, tablas y rutas en español (glosario); nombres en inglés solo cuando son API de librerías.
- Casos de uso devuelven `Result`; acciones devuelven `EstadoFormulario` con códigos de `messages/*.json` (`errores` o el namespace del formulario).
- Las fechas de calendario son `YYYY-MM-DD`; los instantes, ISO con zona; la hora se muestra en la zona horaria de la sede.
- Montos en centavos (`bigint`), con la moneda del evento; nunca se suman monedas distintas.

## Prohibido sin aprobación explícita

`git push --force`, desplegar a producción, aplicar migraciones a entornos remotos, instalar dependencias nuevas, cambiar variables de entorno o DNS, enviar emails reales a terceros, borrar datos. Nunca `--no-verify` ni desactivar RLS.
