# ADR-0007 · Roles y permisos extensibles

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

Hay un rol global (Super Admin), roles por evento (organizador, director técnico, jurado, coordinador, locutor, DJ, staff de acreditación) y roles por academia (titular, profesor). Otros clientes pedirán roles nuevos (por ejemplo, "fiscal de música" o "prensa"). Si las políticas RLS preguntan por nombres de rol, cada rol nuevo obliga a reescribir decenas de políticas.

## Decisión

1. Catálogo de **permisos** (`permiso`) con códigos estables: `evento.configurar`, `evento.miembros`, `inscripciones.ver`, `inscripciones.gestionar`, `liquidaciones.ver`, `cobros.registrar`, `cobros.anular`, `caja.cerrar`, `orden.ver`, `orden.editar`, `orden.operar`, `musica.descargar`, `puntajes.cargar`, `puntajes.supervisar`, `resultados.publicar`, `pases.registrar`, `premios.asignar`, `acreditacion.operar`, `comunicados.enviar`, `auditoria.ver`, `exportar.datos`.
2. Catálogo de **roles de evento** (`rol`) y su matriz `rol_permiso`. Las políticas RLS y los casos de uso preguntan siempre por **permisos**: `private.eventos_con_permiso('orden.editar')`.
3. **Super Admin** vive en `rol_global` y tiene todos los permisos en todos los eventos. Esa tabla no admite escritura desde `authenticated`: se administra con service role o SQL (evita escalada de privilegios).
4. Roles de academia (`TITULAR`, `PROFESOR`) en `academia_miembro`; ambos operan la academia y solo el titular invita o quita miembros.
5. Agregar un rol = insertar en `rol` y `rol_permiso` (migración de datos o panel de Super Admin). No se tocan políticas ni código de pantallas; los menús se derivan de los permisos.

### Matriz inicial

| Permiso                                               | ORGANIZADOR_EVENTO | DIRECTOR_TECNICO | JURADO | COORDINADOR | LOCUTOR | DJ  | STAFF_ACREDITACION |
| ----------------------------------------------------- | ------------------ | ---------------- | ------ | ----------- | ------- | --- | ------------------ |
| evento.configurar, evento.miembros                    | ✓                  |                  |        |             |         |     |                    |
| inscripciones.ver                                     | ✓                  |                  |        |             |         |     | ✓                  |
| inscripciones.gestionar                               | ✓                  |                  |        |             |         |     |                    |
| liquidaciones.ver                                     | ✓                  |                  |        |             |         |     | ✓                  |
| cobros.registrar                                      | ✓                  |                  |        |             |         |     | ✓                  |
| cobros.anular, caja.cerrar                            | ✓                  |                  |        |             |         |     |                    |
| orden.ver                                             | ✓                  | ✓                | ✓      | ✓           | ✓       | ✓   |                    |
| orden.editar, orden.operar                            | ✓                  |                  |        | ✓           |         |     |                    |
| musica.descargar                                      | ✓                  |                  |        |             |         | ✓   |                    |
| puntajes.cargar                                       |                    |                  | ✓      |             |         |     |                    |
| puntajes.supervisar                                   | ✓                  | ✓                |        |             |         |     |                    |
| resultados.publicar, pases.registrar, premios.asignar | ✓                  |                  |        |             |         |     |                    |
| acreditacion.operar                                   | ✓                  |                  |        |             |         |     | ✓                  |
| comunicados.enviar, auditoria.ver, exportar.datos     | ✓                  |                  |        |             |         |     |                    |

`STAFF_ACREDITACION` registra cobros en la mesa (resuelve C-11) pero no los anula ni cierra caja: la anulación queda en el organizador para mantener separación de funciones.

## Alternativas

| Opción                                                              | Pros                                    | Contras                                                                  | Veredicto                                                       |
| ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Rol como `enum` y políticas por rol                                 | Legible                                 | Cada rol nuevo reescribe políticas                                       | Descartada                                                      |
| Claims de permisos en el JWT (custom access token hook)             | Sin consultas en RLS                    | Permisos por evento inflan el token y quedan obsoletos hasta refrescarlo | Descartada para v1; se reevalúa si hay problemas de performance |
| **Catálogo + funciones `security definer` que devuelven conjuntos** | Extensible, una evaluación por consulta | Una consulta extra por sentencia                                         | **Elegida**                                                     |

## Consecuencias

- Las funciones auxiliares viven en el esquema `private` (no expuesto por PostgREST), son `security definer`, `stable` y con `search_path = ''`.
- Las pruebas de RLS se escriben por rol **y** por permiso.
