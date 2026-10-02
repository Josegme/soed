# ADR-0001 · Registro de decisiones de arquitectura

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

SOED se vende como producto a varias organizaciones y lo desarrolla una sola persona asistida por agentes. Las decisiones se pierden si quedan en chats o comentarios.

## Decisión

Toda decisión que afecte estructura, stack, modelo de datos, seguridad o contratos entre capas se registra como ADR en `architecture/decisions/ADR-NNNN-<tema>.md` **antes** de implementarse.

Formato: Estado (Propuesta, Aceptada, Reemplazada por ADR-X), Fecha, Contexto, Decisión, Alternativas consideradas con trade-offs, Consecuencias.

Un ADR aceptado no se edita: si cambia la decisión, se escribe uno nuevo que lo reemplaza y se actualiza el estado del anterior.

## Consecuencias

- `CLAUDE.md` y el plan referencian ADRs en lugar de repetir su justificación.
- Cada parámetro nuevo en `client.config.ts` lleva su ADR (regla de oro de ADR-0003).
