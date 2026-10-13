# SOED — Plan de desarrollo v2

02/10/2026. Reemplaza a la v1 (`docs/historial/PLAN_DESARROLLO_v1_2026-09-30.md`), que sigue vigente en visión, modelo comercial y modelo de eventos (secciones 1 a 4). Esta versión actualiza arquitectura, estado por etapa y próximos pasos. Las contradicciones resueltas están en `docs/auditoria/AUDITORIA_2026-10-02.md`.

## 1. Qué cambió respecto de la v1

- **Infraestructura mínima por instancia:** sin pgmq, pg_cron ni Edge Functions. Colas en tablas de Postgres, límites de frecuencia en Postgres, tareas programadas con Vercel Cron y ZIP de música armado en el navegador (ADR-0013 actualizado, ADR-0014).
- **Clases y entradas sin cobro en línea:** reservas con cupo y cobro manual en el evento, coherente con "el pago nunca limita la participación". La pasarela de pago queda fuera de alcance salvo decisión explícita.
- **Reglamento:** versionado por temporada y copia por evento (SA-07, TR-11).
- **Spec por ID:** el inventario de 207 funcionalidades con su matriz de trazabilidad reemplaza a la carpeta `specs/` como fuente de alcance.

## 2. Estado por etapa

| Etapa                      | Contenido                                                                                                                                                                                                                           | Estado                                                                  | Evidencia                                     |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| 0. Replanteo               | ADR-0001 a ADR-0014, glosario, inventario, CLAUDE v2, arquitectura, esquema                                                                                                                                                         | Hecha                                                                   | `architecture/`, `docs/`                      |
| 1. Fundación               | Monorepo, CI, `client.config` validado, tema por instancia, i18n `es`/`pt-BR`, sitio público, cabeceras de seguridad                                                                                                                | Hecha en código; **despliegue pendiente** de credenciales (P-03 a P-06) | CI, e2e público                               |
| 2. Dominio y datos         | Reglamento con preset 2026, liquidación, cobros, orden, puntajes; 8 migraciones con RLS                                                                                                                                             | Hecha                                                                   | Cobertura de dominio ≥ 90 %, pgTAP            |
| 3. Eventos e inscripciones | Temporadas y eventos (clonar), academias, profesores, bailarines, coreografías reutilizables, fichas validadas, música, tarifario, liquidación versionada con PDF y QR, cobro manual, emails bilingües, campos adicionales, hoteles | Hecha                                                                   | e2e academia, gestión, configuración, hoteles |
| 4. Orden en vivo           | Constructor de orden, publicación, Realtime con respaldo, coordinador, locutor, DJ (ZIP por bloque), multipista, orden del día imprimible, cronograma público                                                                       | Hecha; **medir < 1 s con Realtime real** en staging                     | e2e vivo, público                             |
| 5. Puntajes y pases        | Criterios, planilla offline, director técnico, ranking, publicación (Art. 32), premios, pases manuales, certificados bilingües                                                                                                      | Hecha                                                                   | e2e vivo, resultados; pgTAP Art. 32           |
| 6. Admin avanzado          | Tablero por evento y temporada, historial, exportaciones CSV auditadas, comunicados, audit log, solicitudes, traducciones pendientes                                                                                                | Hecha                                                                   | e2e temporada, documentos, notificaciones     |
| 7. Acreditación            | Credenciales QR con zonas, escaneo offline, mesa de caja offline, búsqueda por QR de la liquidación, horario de la mesa                                                                                                             | Hecha                                                                   | e2e vivo, configuración                       |
| 8. Clases y entradas       | Catálogo, cupos, reservas públicas con límite de frecuencia y anti-bots, reserva de academias, cobro manual                                                                                                                         | Hecha (sin pasarela)                                                    | e2e actividades; pgTAP de cupos               |
| 9. PWA y productización    | Manifest, service worker, página sin conexión, módulos por instancia, sitemap y hreflang, plantilla `_template`, `/nuevo-cliente`, runbooks                                                                                         | Hecha; push (TR-51) fuera de alcance                                    | e2e PWA/SEO; runbooks                         |

## 3. Criterios de salida que requieren entorno real

Se verifican al tener Supabase, Vercel y dominio del cliente (runbook de alta):

1. Página con la marca del cliente en su dominio con HTTPS, en español y portugués.
2. Un reorden visible en 4 dispositivos en menos de 1 segundo (Realtime).
3. Simulacro: 20 coreografías y 3 jurados con ranking correcto (el ranking es sugerencia; pases manuales).
4. 100 acreditaciones de prueba en menos de 15 minutos con 2 celulares.
5. Un segundo cliente de prueba levantado en menos de un día siguiendo `docs/runbooks/ALTA_CLIENTE.md`.

## 4. Próximos pasos

1. Resolver los bloqueantes de `docs/PENDIENTES.md` (Supabase, Vercel, dominio, Resend). La GitHub App quedó instalada y la rama publicada el 13/10/2026.
2. Crear `main` y abrir un PR por etapa (requiere P-07).
3. Staging del primer cliente: migraciones, seed, smoke test y criterios de salida de la sección 3.
4. Validar el inventario contra `FUNCIONALIDADES.md` v1.2 y el preset contra las Bases 2026 completas (N-01, N-02).
5. Piloto con un selectivo (3 a 5 academias reales) antes de la final.
6. Workflow de migraciones por instancia con bloqueo de cambios destructivos durante eventos en curso (TR-41), al tener los proyectos creados.
