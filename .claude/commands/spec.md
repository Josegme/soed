---
description: Preparar la implementación de una o más funcionalidades del inventario por ID
argument-hint: <ID> [ID…]
---

Vas a preparar la implementación de $ARGUMENTS en SOED. No escribas código todavía.

1. Leé las filas de `docs/auditoria/inventario.csv` con esos IDs y su estado en `docs/auditoria/MATRIZ_TRAZABILIDAD.md`.
2. Revisá `CLAUDE.md`, los ADR que apliquen (`architecture/decisions/`) y `docs/GLOSARIO.md`.
3. Ubicá el código existente relacionado (módulo, tablas, políticas RLS, pantallas, pruebas).
4. Respondé con:
   - **Qué existe** y qué falta, con rutas de archivo.
   - **Supuestos** (marcados) y **preguntas** para el negocio; no inventes reglas.
   - **Plan por capas**: migración + RLS + pgTAP → dominio → casos de uso → interfaz → UI es/pt-BR → e2e con axe.
   - **Riesgos**: seguridad (RLS, service role, datos de menores), Art. 32, pago que no bloquea, pases manuales, módulos por instancia.
   - **Pruebas** que llevarán la etiqueta de cada ID.
