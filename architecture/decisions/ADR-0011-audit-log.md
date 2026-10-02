# ADR-0011 · Audit log append-only por triggers

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

Cobros, anulaciones, pases, publicación de resultados, reaperturas de planillas, excepciones de reglamento y asignación de roles necesitan trazabilidad para resolver disputas entre academias y organizadores.

## Decisión

1. Tabla `auditoria` (`bigint identity`, `ocurrido_at`, `usuario_id`, `evento_id`, `tabla`, `registro_id`, `accion`, `antes`, `despues`, `contexto`).
2. Trigger genérico `private.auditar()` (`security definer`) en las tablas sensibles: `rol_global`, `evento_miembro`, `evento` (cambios de reglamento, publicación y estado), `ficha` (estado, excepción y bloqueo), `liquidacion_version`, `cobro`, `turno_caja`, `planilla` (después de enviada), `resultado`, `pase`, `premio_asignacion`, `orden_item` (reorden y estado).
3. Se registran solo las columnas que cambiaron. Se excluyen columnas con datos personales de menores (`documento`, `fecha_nacimiento`).
4. Sin políticas de `UPDATE` ni `DELETE`; `INSERT` solo desde el trigger. Lectura: Super Admin (toda la instancia) y `auditoria.ver` (su evento).

## Alternativas

| Opción | Contras | Veredicto |
| --- | --- | --- |
| Auditoría en los casos de uso | Se omite si alguien escribe por otra vía | Descartada |
| Extensión `pgaudit` | Log de servidor, no consultable por el organizador | Complementaria, no reemplaza |
| **Triggers + tabla append-only** | Costo de escritura extra en tablas sensibles | **Elegida** |

## Consecuencias

- Retención: se conserva mientras exista la instancia; la purga de datos de menores (política por cliente) anonimiza `usuario_id` y payloads.
