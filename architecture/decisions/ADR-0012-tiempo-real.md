# ADR-0012 · Tiempo real del orden de salida

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

Un reorden o un cambio de estado ("en escena") debe verse en coordinador, locutor, DJ, jurados y academias en menos de 1 segundo (criterio de salida de la etapa 4). Vercel no mantiene WebSockets.

## Decisión

1. **Fuente de verdad:** `orden_item` en Postgres. Los cambios se hacen con funciones transaccionales (`reordenar_orden`, `cambiar_estado_orden`) que validan permisos y escriben la auditoría.
2. **Propagación:** Supabase Realtime **Postgres Changes** sobre `orden_item` filtrado por `evento_id`. RLS se aplica a cada suscriptor.
3. **Baja latencia opcional:** para el evento "en escena" la interfaz del coordinador además emite un **Broadcast** en el canal `evento:<id>:vivo` (sin datos personales), que llega antes que el cambio de base. El cliente reconcilia con el estado de la base.
4. **Resiliencia:** al reconectar, cada vista vuelve a pedir el estado completo (`select`) antes de aplicar eventos nuevos. Si el canal cae, se hace polling cada 5 s.

## Alternativas

| Opción | Contras | Veredicto |
| --- | --- | --- |
| Socket.io + Redis | Requiere servidor propio (descartado en ADR-0002) | Descartada |
| Polling | Latencia y carga | Solo como respaldo |
| **Postgres Changes + Broadcast** | Límite de conexiones por plan de Supabase | **Elegida** |

## Consecuencias

- Antes de cada evento se revisan los límites de conexiones del plan (riesgo R-07) y se ejecuta una prueba de carga.
