---
description: Revisión propia de los cambios contra el inventario, las reglas y la checklist de seguridad
---

Revisá los cambios sin commitear (`git diff` y archivos nuevos) como lo haría un revisor senior de SOED.

Verificá y reportá con archivo y línea:

1. **Arquitectura**: el dominio no importa nada externo; casos de uso con `Result`; la interfaz no habla con Supabase salvo por infraestructura; sin `if (cliente === 'x')`; módulos con `moduloOn()`/`exigirModulo()`.
2. **Base de datos**: RLS en cada tabla nueva en la misma migración; `(select auth.uid())`; helpers en `private`; índice en cada FK; RPC `security definer` con `search_path = ''`, grants mínimos y sin datos personales; pgTAP por rol.
3. **Negocio**: el pago no bloquea nada; pases manuales; resultados solo tras publicar; categoría por edad a la fecha del evento; tolerancias desde el reglamento.
4. **Seguridad**: Zod en el borde; `service_role` solo donde lo permite ESLint; nada de secretos; buckets privados con URL firmada; límites de frecuencia en endpoints públicos; auditoría de exportaciones.
5. **i18n y a11y**: sin literales; claves en `es` y `pt-BR`; formularios con etiqueta, errores asociados y mensajes en `role=status|alert`; contraste y tamaños de toque.
6. **Pruebas**: cada ID nuevo con una prueba que lo ejercite de verdad; e2e con axe para pantallas nuevas; `pnpm trace` actualizado.

Terminá con: bloqueantes, mejoras recomendadas y los comandos que faltan correr.
