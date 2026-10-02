# ADR-0005 · Idiomas: español y portugués desde la etapa 1

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

El evento de referencia publica su reglamento en español y portugués y reúne academias de Argentina y Brasil. Agregar idiomas después obliga a revisar cada pantalla, email y PDF.

## Decisión

| Capa                      | Solución                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interfaz                  | `next-intl` con locales `es` y `pt-BR`; rutas `/es` y `/pt` (prefijo personalizado para `pt-BR`); selector visible; idioma guardado en `perfil.idioma`                        |
| Mensajes                  | `apps/web/messages/{es,pt-BR}.json`; ningún texto visible en literal                                                                                                          |
| Contenido del organizador | Columnas `jsonb` tipo `Traducible = { es?: string; 'pt-BR'?: string }`. Si falta la traducción se muestra el idioma por defecto del evento y el panel la marca como pendiente |
| Salidas                   | Emails, PDFs, certificados y credenciales en el idioma de cada destinatario                                                                                                   |
| Formatos                  | `Intl` según el idioma; hora en la zona horaria de la sede; moneda del evento                                                                                                 |
| Datos de usuarios         | Nombres de academias, coreografías y bailarines no se traducen                                                                                                                |

**Extensibilidad.** Los idiomas soportados se declaran en un catálogo único (`apps/web/src/lib/i18n/locales.ts`) y cada instancia elige un subconjunto en `client.config.idiomas`. Agregar un idioma = agregar el código al catálogo, el archivo de mensajes y la clave en `Traducible`; ninguna pantalla cambia.

**Control en CI.** `pnpm i18n:check` falla si una clave existe en un idioma y no en el otro, o si hay valores vacíos.

## Consecuencias

- El código y la base usan nombres de dominio en español (ver `docs/GLOSARIO.md`).
- Los mensajes de validación del reglamento se emiten como códigos (`TOLERANCIA_GRUPO_EXCEDIDA`) y se traducen en la interfaz; el dominio nunca devuelve texto.
