# ADR-0010 · Modo offline para mesa de cobros, acreditación y jurado

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

El WiFi de los venues es inestable. La mesa de acreditación y cobros y la planilla del jurado no pueden detenerse por falta de red (plan §11; prompt).

## Decisión

1. **Outbox local.** Las operaciones se escriben primero en IndexedDB (`idb`) como comandos con `client_uuid` (UUID v4), tipo, payload y timestamp del dispositivo.
2. **Sincronización.** Al recuperar la red (eventos `online`, reintento exponencial y botón manual) se envían en orden FIFO a un Route Handler que valida con Zod, verifica permisos y llama al caso de uso. La base garantiza idempotencia con `UNIQUE (client_uuid)`: un reintento devuelve el registro existente.
3. **Lectura offline.** Antes del evento el dispositivo descarga un paquete de datos mínimo (liquidaciones con total y cobrado, credenciales a acreditar, fichas a puntuar), cifrado en reposo con una clave derivada de la sesión y borrado al cerrar sesión.
4. **Conflictos.** Los cobros son aditivos y no conflictúan. Una acreditación duplicada es idempotente. Para planillas gana la última versión enviada por el mismo jurado, salvo que el director técnico la haya cerrado: el servidor rechaza y la interfaz lo informa.
5. **Indicador visible** de estado de conexión y de cantidad de operaciones pendientes.

## Alternativas

| Opción                                                       | Contras                                 | Veredicto          |
| ------------------------------------------------------------ | --------------------------------------- | ------------------ |
| Base local completa con replicación (PowerSync, ElectricSQL) | Proveedor extra por instancia y costo   | Descartada para v1 |
| Solo reintento en memoria                                    | Pierde datos si se cierra la pestaña    | Descartada         |
| **Outbox en IndexedDB + idempotencia en base**               | Lógica de sincronización propia acotada | **Elegida**        |

## Consecuencias

- `cobro`, `acreditacion_registro` y `planilla` llevan `client_uuid unique`.
- Pruebas: unitarias del outbox con `fake-indexeddb` y e2e con red simulada caída en Playwright.
