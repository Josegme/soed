# ADR-0009 · Liquidación, numeración y cobros append-only

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

SOED no procesa pagos. Calcula cuánto debe cada academia, emite una liquidación descargable y el organizador o el staff registran los cobros a mano, incluso sin conexión. El pago nunca limita la participación.

## Decisión

1. **Cálculo en el dominio.** `calcularLiquidacion(tarifario, inscripcion, fichas)` es una función pura que devuelve líneas y total en unidades menores (centavos) de la moneda del evento. Soporta los modos del plan: por bailarín, por coreografía (precio por formación), por participación (desde la n-ésima), monto fijo por academia, rubros opcionales, recargos (multiplicador o monto) y ajuste libre o sin cargo.
2. **Numeración.** Cada academia inscripta tiene una `liquidacion` con número `LIQ-<SLUG>-<NNNN>` (4 dígitos con ceros; crece a 5 si supera 9999). El correlativo es por evento y se asigna con `UPDATE evento_contador … RETURNING` dentro de la transacción: sin huecos por concurrencia ni duplicados. El número no cambia entre versiones.
3. **Versiones.** Cada emisión crea `liquidacion_version` (número de versión, total, detalle `jsonb`, idioma, `qr_token`). La versión anterior queda vigente en el historial. Saldo = total de la última versión − cobros no anulados. Si la academia agrega coreografías después de pagar, el saldo es la diferencia.
4. **Estados derivados** (vista, nunca columna editable): `SIN_CARGO` (total 0), `PENDIENTE` (cobrado 0), `PARCIAL`, `PAGADA` (cobrado ≥ total). Ningún estado participa de reglas de inscripción, acreditación, orden ni puntaje.
5. **Cobros append-only.** `cobro` no admite `DELETE` (sin política y con trigger que lo impide) ni cambios de monto. Un error se corrige anulando con motivo; quién y cuándo quedan registrados.
6. **Idempotencia offline.** Cada cobro lleva `client_uuid` único generado en el dispositivo. Reintentar la sincronización no duplica.
7. **QR.** El QR de la liquidación codifica una URL interna con `qr_token` aleatorio (no el número), que solo resuelve para usuarios con `liquidaciones.ver` en el evento.

## Alternativas

| Opción | Contras | Veredicto |
| --- | --- | --- |
| `SEQUENCE` de Postgres por evento | Deja huecos en rollbacks; una secuencia por evento | Descartada |
| `max(numero) + 1` | Duplicados bajo concurrencia | Descartada |
| **Tabla contador con `UPDATE … RETURNING`** | Bloqueo breve por fila | **Elegida** |

## Consecuencias

- Los montos se guardan como `bigint` en centavos con `moneda` explícita; nunca `float`.
- El PDF aclara que no es factura ni comprobante fiscal.
