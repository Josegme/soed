# ADR-0006 · Reglamento configurable: plantilla de temporada + snapshot versionado por evento

- Estado: Aceptada
- Fecha: 2026-10-02
- Resuelve: contradicción C-02 de la auditoría (reglamento "único por temporada" vs. "configurable por evento")

## Contexto

El plan dice a la vez que el reglamento es único para la temporada (§3, "Reglamento y premios") y que el organizador lo ajusta en cada evento (§3, "Qué configura el admin"). Las reglas (Art. 5, 6, 7, 14, 15, 33 de las Bases 2026) no pueden ser constantes de código porque SOED se vende a otras organizaciones.

## Decisión

1. **Plantilla de temporada.** `reglamento` guarda configuraciones con nombre, `preset` de origen y `version`. La temporada apunta a su reglamento por defecto.
2. **Snapshot por evento.** Al crear un evento se copia el reglamento de la temporada en `evento.reglamento` (`jsonb`) con `evento.reglamento_version`. El organizador puede ajustarlo hasta que exista la primera ficha enviada.
3. **Cambios con fichas enviadas.** Cada cambio posterior incrementa `reglamento_version`, queda en auditoría y marca las fichas para revalidar. El sistema nunca rechaza en silencio una ficha ya enviada: muestra la nueva infracción al organizador y a la academia.
4. **Esquema tipado.** La forma del `jsonb` se define con tipos en `packages/domain` y con Zod en `packages/shared-types` (`ReglamentoSchema`, `schema_version` explícito). La base agrega un `CHECK` estructural mínimo (claves obligatorias). El dominio valida contra el objeto y nunca contra constantes.
5. **Códigos, no textos.** Categorías, géneros y formaciones tienen `codigo` estable (`JUVENIL`, `JAZZ`, `GRUPO`) y `nombre` traducible. Las fichas guardan códigos; un trigger verifica que el código exista en el reglamento del evento.

### Parámetros del reglamento

| Grupo               | Parámetros                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edad                | `fechaReferenciaEdad` (`INICIO_EVENTO`, `FIN_EVENTO` o fecha fija); edad en años cumplidos                                                                      |
| Categorías          | código, nombre, `edadMin`, `edadMax` (abierta), orden                                                                                                           |
| Formaciones         | código (`SOLO`, `DUO`, `TRIO`, `GRUPO`, `QUADRO`…), integrantes mín/máx, tolerancia de tiempo en segundos, criterio de categoría (`MAYOR` o `TOLERANCIA_GRUPO`) |
| Tolerancia de grupo | porcentaje (30), redondeo (`FLOOR`, `CEIL`, `ROUND`), dirección (`AMBAS`, `SOLO_MENORES`, `SOLO_MAYORES`), solo categorías adyacentes (sí/no)                   |
| Géneros             | código, nombre, categorías habilitadas (vacío = todas), edad mínima opcional                                                                                    |
| Tiempos             | reglas `{ genero?, formacion?, categoria?, maxSegundos }`; gana la regla más específica                                                                         |
| Clasificación       | bandas ordenadas `{ codigo, nombre, umbral }` (preset: 9,0 / 8,0 / 7,0)                                                                                         |
| Puntaje             | escala mín/máx, decimales, agregación (`PROMEDIO` o `PROMEDIO_SIN_EXTREMOS`), umbral de desvío                                                                  |

## Alternativas

| Opción                                                 | Pros                                                         | Contras                                                              | Veredicto   |
| ------------------------------------------------------ | ------------------------------------------------------------ | -------------------------------------------------------------------- | ----------- |
| Constantes en `packages/domain`                        | Simple                                                       | No vendible a otro cliente                                           | Descartada  |
| Tablas normalizadas (`categoria`, `genero`, `tiempo`…) | FKs reales, SQL directo                                      | Clonar y versionar es costoso; cada parámetro nuevo es una migración | Descartada  |
| **`jsonb` tipado + snapshot por evento**               | Clonado trivial, versionado, parámetros nuevos sin migración | Integridad por trigger y Zod en lugar de FK                          | **Elegida** |

## Consecuencias

- El preset del Encuentro de Danzas vive en `clients/_template/seed.sql` y en `packages/domain/src/reglamento/presets/encuentro-2026.ts`. Los valores que no constan en el plan quedan marcados como `SUPUESTO` hasta validarlos con las Bases 2026.
- Agregar una regla nueva = nuevo campo opcional en el tipo, el schema y el validador, con default neutro: los reglamentos existentes siguen válidos.
