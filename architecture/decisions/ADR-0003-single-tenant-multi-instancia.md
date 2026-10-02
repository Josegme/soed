# ADR-0003 · Single-tenant multi-instancia

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

Los clientes de SOED son organizaciones que compiten entre sí y no aceptan compartir base de datos. Mantener un fork por cliente hace que cada corrección se porte a mano.

## Decisión

Un repositorio Core y una instancia aislada por cliente: su proyecto Supabase (staging y prod), su proyecto Vercel y su dominio. Lo que varía entre clientes vive en `clients/<slug>/` y se selecciona con `SOED_CLIENT=<slug>` en build:

- `client.config.ts`: nombre, dominio, idiomas, módulos activos, remitente de email, preset de reglamento, datos legales. Se valida con Zod en build y el deploy falla si está incompleto.
- `theme.css`: tokens de color, tipografía y radios.
- `assets/`: logo, favicon e imágenes.
- `seed.sql`: reglamento, categorías, géneros y criterios del cliente.

**Regla de oro:** si una diferencia obliga a escribir `if (cliente === 'x')`, falta un parámetro. Se agrega en `client.config.ts` o en la configuración del evento, apagado por defecto, y se documenta con un ADR.

## Alternativas

| Opción                              | Aislamiento | Costo de mantener N clientes | Veredicto                                                                              |
| ----------------------------------- | ----------- | ---------------------------- | -------------------------------------------------------------------------------------- |
| Multitenant (una base, `tenant_id`) | Lógico      | Bajo                         | Descartada: los clientes no aceptan convivir y una falla de RLS expone a un competidor |
| Fork por cliente                    | Total       | Alto                         | Descartada                                                                             |
| **Core + instancia por cliente**    | **Total**   | **Bajo**                     | **Elegida**                                                                            |

## Consecuencias

- Ninguna tabla lleva `tenant_id`.
- Las migraciones se aplican a cada proyecto Supabase con un workflow que recorre la lista de clientes y bloquea migraciones destructivas si hay un evento en curso.
- El costo de infraestructura por cliente (Supabase Pro + Vercel Pro) se traslada al abono mensual.
