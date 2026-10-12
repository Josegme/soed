# ADR-0014 · Límites de frecuencia, colas y trabajo pesado sin infraestructura extra

- Estado: Aceptada
- Fecha: 2026-10-02

## Contexto

El inventario preveía pgmq, pg_cron y Edge Functions para tareas largas (TR-45: ZIP de música, envíos masivos) y "rate limits de Supabase Auth + proxy" para endpoints públicos (TR-34). Cada instancia es un proyecto Supabase y uno de Vercel por cliente: cada pieza de infraestructura adicional se multiplica por N clientes en costo, despliegue y monitoreo.

## Decisión

1. **Límite de frecuencia en Postgres.** `private.limite_frecuencia` (ventana fija por clave) y `private.consumir_limite(clave, maximo, ventana)`. Las RPC públicas que crean filas (`reservar_entrada`, `reservar_clase`) solo las ejecuta `service_role`; el servidor arma la clave con un **HMAC de la IP** (`ORIGEN_HMAC_SECRETO`), nunca la IP en claro, y la base aplica el límite por origen y por email junto con publicación y cupo. Anti-bots con campo trampa. El login usa los límites nativos de Supabase Auth.
2. **Cupos con bloqueo de la fila padre** (`select … for update`) en triggers, para que reservas simultáneas no superen el cupo.
3. **ZIP de música en el navegador.** El servidor firma las URLs del bucket privado; el dispositivo del DJ baja cada archivo y arma un ZIP STORE (sin compresión: el audio ya está comprimido) con nombres `001 - Coreografía - Academia.mp3`. Sin dependencia nueva (escritor ZIP propio con CRC-32, validado con `unzip` en pruebas) y sin límite de tamaño de respuesta de funciones.
4. **Tareas programadas en Vercel Cron** (ADR-0013), con `CRON_SECRET`.
5. **Service worker mínimo** (PU-14): solo cachea la página "sin conexión" de cada idioma y estáticos con hash de `/_next/static`. Nunca HTML del panel, API ni datos de Supabase; lo cargado sin conexión vive en la cola IndexedDB (ADR-0010).

## Alternativas

| Opción                                 | Contras                                                                              | Veredicto   |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| Redis / Upstash para rate limit        | Servicio extra por cliente; descartado en ADR-0002                                   | Descartada  |
| pgmq + Edge Function para ZIP          | Memoria y tiempo de función con bloques de cientos de MB; otro runtime que desplegar | Descartada  |
| JSZip / fflate                         | Dependencia nueva para una necesidad de 120 líneas                                   | Descartada  |
| **Postgres + navegador + Vercel Cron** | Ventana fija admite ráfagas en el borde de ventana                                   | **Elegida** |

## Consecuencias

- Cero servicios nuevos por instancia; todo se prueba con pgTAP, Vitest y Playwright en CI.
- Si un cliente necesita envíos masivos de más de unos miles de emails por corrida, se revisa este ADR (el cron procesa lotes acotados).
- La limpieza de ventanas viejas del limitador es oportunista (cada consumo borra lo de más de un día).
