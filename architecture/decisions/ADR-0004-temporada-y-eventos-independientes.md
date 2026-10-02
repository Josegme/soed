# ADR-0004 · Temporada y eventos independientes

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

Una organización corre una temporada con varios selectivos y una final. Academias, bailarines y coreografías se reutilizan en toda la temporada; inscripción, categoría, orden, puntajes, cobros y acreditación son propios de cada evento. Cada selectivo puede tener su propio organizador, que solo debe ver su evento.

## Decisión

1. Jerarquía: Organización (la instancia) → `temporada` → `evento` (SELECTIVO, FINAL o UNICO).
2. Datos compartidos a nivel organización: `academia`, `bailarin`, `coreografia`, `coreografia_bailarin`.
3. Datos propios del evento: toda tabla con datos de evento lleva `evento_id NOT NULL`, indexado, y su RLS filtra por evento.
4. `Coreografia` (reutilizable) se separa de `Ficha` (su inscripción a un evento). La ficha copia elenco y música vigentes al inscribirse (`ficha_bailarin`) para que un cambio posterior no altere eventos pasados.
5. Roles por evento en `evento_miembro (evento_id, usuario_id, rol)`. Un usuario puede tener roles en varios eventos. Los permisos de cada rol se resuelven con ADR-0007.
6. El pase de un selectivo a la final es un registro manual (`pase`) con motivo, autor, fecha y beneficio opcional. No existe regla automática ni bloqueo de inscripción por falta de pase.

## Alternativas

| Opción | Pros | Contras | Veredicto |
| --- | --- | --- | --- |
| Ficha que incluye la coreografía | Simple | Reinscribir obliga a recargar elenco y música | Descartada |
| **Coreografía + ficha con snapshot** | Reinscripción en un clic, historia inmutable | Duplicación controlada del elenco | **Elegida** |
| Organizador global por temporada | Menos filas en `evento_miembro` | Rompe el aislamiento entre organizadores de selectivos | Descartada |

## Consecuencias

- Las políticas RLS usan funciones `private.eventos_con_permiso(<permiso>)` que devuelven el conjunto de eventos del usuario; se evalúan una vez por consulta.
- La categoría de cada bailarín se calcula por evento (edad a la fecha de referencia del evento) y se guarda en `ficha_bailarin`.
