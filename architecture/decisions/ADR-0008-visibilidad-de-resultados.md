# ADR-0008 · Visibilidad de resultados (Art. 32) y datos públicos

- Estado: Aceptada
- Fecha: 2026-10-02
- Corrige: spec F3-01 del paquete original (notas visibles solo para el director técnico)

## Contexto

Art. 32 de las Bases: las notas y los comentarios del jurado quedan disponibles para los dirigentes de cada academia una vez publicados los resultados. Antes de la publicación, nadie fuera de jurados, director técnico y organizador puede verlos. El sitio público muestra orden y resultados sin datos personales de menores.

## Decisión

1. `evento.resultados_publicados_at` es la única llave de visibilidad. Solo el permiso `resultados.publicar` la escribe y la acción queda auditada. Despublicar es posible y también queda auditado.
2. RLS:
   - `planilla` y `planilla_nota`: el jurado ve las suyas; `puntajes.supervisar` ve todas las del evento; los miembros de la academia ven las de sus fichas **solo si** el evento está publicado y la planilla está enviada.
   - `resultado`: `puntajes.supervisar` siempre; academia propietaria y público solo con evento publicado.
3. Las academias reciben las devoluciones con el jurado anonimizado ("Jurado 1, 2, 3") mediante una vista con `security_invoker`. La identidad del jurado no se expone (supuesto a validar con el organizador).
4. **Datos públicos** (anon): eventos y temporadas publicados por RLS directa; orden de salida y resultados mediante funciones RPC `security definer` (`publico_orden`, `publico_resultados`) que devuelven solo columnas no sensibles: coreografía, academia, ciudad, categoría, género, formación, puesto, banda. Nunca nombres ni edades de bailarines.

## Alternativas

| Opción                                            | Contras                                                           | Veredicto   |
| ------------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| Copiar resultados a una tabla pública al publicar | Duplicación y desincronización                                    | Descartada  |
| Vistas `security definer`                         | Las marca el advisor de Supabase y saltean RLS de forma implícita | Descartada  |
| **RLS condicionada + RPC acotadas para anon**     | Requiere pruebas por rol                                          | **Elegida** |

## Consecuencias

- Las pruebas `rls:art32` cubren antes y después de la publicación para academia, jurado ajeno, director técnico y anon.
