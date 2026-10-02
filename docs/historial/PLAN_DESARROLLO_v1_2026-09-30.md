# SOED — Plan de desarrollo end-to-end

30/09/2026 · JosegmeDev

> Copia en Markdown del documento vivo. La versión editable, con diagramas y comentarios, está en https://claude.ai/code/artifact/2c2ce96d-5c51-40f2-bd47-179e44e769d4. Si difieren, gana la versión viva.

## 1. La idea en una página

SOED es una plataforma web que digitaliza de punta a punta la operación de un evento competitivo de danza: desde que la academia se inscribe hasta que se publican los resultados. El primer cliente es la organización del Encuentro de Danzas (+100 academias, +1.000 bailarines, varias pistas en paralelo).

**Problemas que resuelve:**

- Inscripciones en planillas y mails sueltos, con errores de categoría y tolerancia que se detectan tarde.
- Música mal rotulada que el DJ tiene que buscar a mano el día del evento.
- Orden de salida que cambia en vivo y nadie se entera (locutor, DJ, jurado, bailarines).
- Puntajes en papel, sumados a mano, sin trazabilidad ni control de desvíos.
- Acreditación lenta en puerta y comunicación masiva desordenada.

**Actores del sistema:** Super Admin (organizador), Profesor/Academia, Coordinador en vivo, Locutor, DJ, Jurado, Director Técnico de Jurados, Staff de acreditación y Público.

**Alcance funcional:** ~180 funcionalidades inventariadas en `FUNCIONALIDADES.md`, agrupadas en 8 fases (inscripciones, orden en vivo, puntajes, admin avanzado, acreditación, clases y entradas, PWA y app nativa opcional).

**Principio de producto:** SOED es el sistema; el evento es un dato. Todo lo que varía entre organizaciones (marca, reglamento, categorías, criterios, textos) tiene que ser configuración, no código.

## 2. Modelo comercial: un producto, una instancia por organización

Decisión: **single-tenant multi-instancia**. Un solo código base (SOED Core) y, por cada organización cliente, su propia instancia aislada: su proyecto Supabase, su proyecto Vercel y su dominio. No hay base de datos compartida entre competidores.

| Opción | Aislamiento de datos | Costo de mantener N clientes | Veredicto |
| --- | --- | --- | --- |
| Multitenant (una base, `tenant_id`) | Lógico, mismo servidor | Bajo | Descartado: los clientes compiten y no aceptan convivir |
| Fork del repo por cliente | Total | Alto: cada fork diverge y los fixes se portan a mano | Descartado |
| **Un repo Core + una instancia por cliente** | **Total** | **Bajo: un fix se despliega a todas las instancias** | **Elegido** |

**Cómo se personaliza sin tocar código:**

- **Marca:** logo, colores, tipografía, nombre, dominio y textos legales en un archivo de configuración del cliente.
- **Reglamento:** categorías, rangos de edad, tolerancias, tiempos máximos, géneros y umbrales de clasificación cargados como datos de cada evento, no hardcodeados.
- **Módulos:** feature flags por cliente (por ejemplo, un cliente sin venta de entradas o sin acreditación QR).
- **Campos adicionales, criterios de puntaje y premios:** ya son configurables desde el panel admin.

**Regla de oro para el desarrollo:** si una diferencia entre clientes obliga a escribir `if (cliente === 'x')`, es un síntoma de que falta un parámetro de configuración. Se modela como configuración y se documenta en un ADR.

**Qué se le vende al cliente:** setup de su instancia + personalización + abono mensual de hosting, soporte y actualizaciones. El código sigue siendo tuyo; el cliente licencia el uso.

## 3. Modelo de eventos: temporada, selectivos y final

Una organización no corre un evento por año sino una temporada: varios selectivos en distintas regiones y países, y una final o encuentro cultural. El Super Admin crea y configura cada evento desde el panel, sin tocar código, y puede clonar la configuración de un evento anterior.

**Jerarquía:** Organización (la instancia) → Temporada (ej. 2027) → Eventos (Selectivo, Final o Evento único), cada uno con su sede, fechas, reglamento, precios, pistas y jurados.

*[Diagrama en la versión viva: Temporada 2027 → Selectivos región 1, 2 y 3 → pases → Final (encuentro cultural); academias, bailarines y coreografías compartidos en toda la temporada.]*

Cada evento tiene su configuración propia; academias, bailarines y coreografías se cargan una vez y sirven para toda la temporada.

**Qué se comparte y qué es propio de cada evento:**

| Compartido en toda la organización | Propio de cada evento |
| --- | --- |
| Cuenta y perfil de la academia | Inscripción de la academia al evento y su pago |
| Bailarines (se cargan una sola vez) | Categoría de cada bailarín, calculada a la fecha de ese evento |
| Coreografías: nombre, género, tipo, elenco y música | Ficha: la coreografía inscripta a ese evento, con su estado y bloqueo |
| Historial de resultados y pases | Orden de salida, puntajes, ranking, premios y acreditación |

**Cambio de modelo:** hoy la Ficha mezcla la coreografía con su inscripción. Se separan en `Coreografia` (reutilizable) y `Ficha` (su inscripción a un evento). Así una academia reinscribe en la final la misma coreografía que presentó en un selectivo con un clic, sin volver a cargar elenco ni música.

**Qué configura el admin en cada evento:**

| Grupo | Parámetros | Ejemplo tomado de las Bases y Condiciones 2026 |
| --- | --- | --- |
| Datos generales | Nombre en español y portugués, tipo, estado, idioma por defecto | Final: Intercâmbio Cultural de Dança |
| Sede y fechas | Venue, ciudad, estado o provincia, país, zona horaria, fechas del evento | Florianópolis, SC, Brasil · 30/04 al 04/05/2026 |
| Inscripción | Apertura, cierre, cierre de modificaciones, cupos | 10/08/2025 al 20/04/2026 o hasta agotar vacantes |
| Reglamento | Categorías y edades, tolerancias, géneros habilitados por categoría, tiempos por género, tipo y categoría, tamaño de grupo, umbrales de clasificación | Art. 5 a 7, 14, 15 y 33 |
| Comercial | Moneda, tarifario (por bailarín, por coreografía, por participación, monto fijo o libre), rubros opcionales, recargos, datos de pago informativos, paquetes y hoteles | Coreografía extra cobrada por participante; Quadro cuesta como dos coreografías; primeros 400 inscriptos al Hotel HCI |
| Premios | Premios principales con monto, premios especiales, regla de empate | R$ 3.000 a la mejor coreografía; empate divide el monto |
| Operación | Pistas, jurados y staff asignados, criterios de puntaje, cronograma, horario de acreditación | Acreditación el primer día de 9 a 18 h |

**Pase de selectivo a final:** cada evento es independiente y quién avanza lo deciden los organizadores y jurados, fuera del sistema (puede ir a la final un grupo que no ganó, o avanzar el siguiente puesto cuando el primero abandona). El organizador registra a mano cada habilitación como un `Pase` para la coreografía o academia que elija, con motivo, autor y fecha, y con un beneficio opcional (descuento o beca). No hay regla automática: el sistema solo ofrece la lista por puesto como ayuda y un pase nunca bloquea una inscripción.

**Organizadores por evento:** el Super Admin crea y administra los usuarios organizadores de cada selectivo o final (rol `ORGANIZADOR_EVENTO`). Cada organizador ingresa a la misma cuenta pero ve y configura solo su evento (inscripciones, orden, jurados, tarifario, cobros, acreditación); el aislamiento se aplica con RLS por evento. Supuesto a validar: un organizador puede administrar más de un evento si el Super Admin se lo asigna.

**Reglamento y premios:** el reglamento es único para toda la temporada (preset 2026). El Super Admin puede crear premios especiales y premios nuevos, globales a la temporada o propios de un evento, con criterio de asignación manual o por ranking, e incluirlos en resultados y certificados.

**Liquidación de inscripción, sin cobro en la plataforma:** SOED no procesa ni valida pagos. Con el tarifario que configura el organizador calcula cuánto debe cada academia, y la academia descarga una liquidación en PDF, en su idioma, con el detalle y los datos de pago que el organizador decida mostrar. Cómo y si paga después queda fuera del sistema.

| Modo de cobro | Cómo se calcula | Ejemplo |
| --- | --- | --- |
| Por bailarín | Bailarines distintos × precio | Inscripción base por participante |
| Por coreografía | Coreografías × precio, con precio distinto por tipo si el organizador quiere | Solo, dúo, trío y grupo con valores diferentes |
| Por participación | Cada bailarín en cada coreografía × precio | Coreografía extra de un bailarín que ya está en otra (Art. 12) |
| Monto fijo por academia | Un importe por inscripción al evento | Cuota de la academia |
| Rubro opcional | La academia lo tilda; precio por unidad que define el organizador | Competir por vestuario |
| Recargo | Multiplicador o monto sobre una coreografía o un bailarín | Quadro de hasta 10 minutos cuesta como dos; corégrafo que baila paga inscripción |
| Libre o sin cargo | Monto que el organizador fija a mano para una academia | Becas, invitados, acuerdos especiales |

**Reglas de la liquidación:**

- El total se recalcula en vivo mientras la academia carga elenco, coreografías y rubros.
- Cada liquidación lleva número, fecha y un QR; si la inscripción cambia se genera una versión nueva y la anterior queda en el historial.
- El PDF aclara que no es una factura ni un comprobante fiscal.
- El organizador ve el total esperado por academia, por evento y por temporada.

**Cobro en el evento:** el pago nunca limita la participación. Se registra cuando y como se cobre, sin cortar la fila de acreditación.

1. El profesor llega a la mesa con la liquidación impresa o en el celular.
2. El organizador de turno escanea el QR o busca por número o academia, y ve total, lo ya cobrado y el saldo.
3. Registra el cobro: monto (propone el saldo), medio (efectivo, Mercado Pago, transferencia, PIX u otro que configure el organizador), referencia opcional y nota.
4. La liquidación pasa a Pagada o Parcial; el organizador sella el papel y sigue acreditando.

**Reglas del cobro:**

- Se aceptan pagos parciales y varios cobros por liquidación; el saldo se calcula solo.
- Estados: Pendiente, Parcial, Pagada y Sin cargo. Ninguno bloquea inscripción, acreditación ni presentación.
- Cada cobro guarda quién lo registró y cuándo. Un error se corrige anulándolo con motivo, nunca borrándolo.
- Si la academia agrega coreografías después de pagar, la nueva versión muestra solo la diferencia como saldo.
- La mesa funciona sin conexión y sincroniza los cobros al volver la red.
- Cierre de caja por turno: total cobrado por medio y por persona, para rendir el efectivo.
- El profesor ve en su panel lo cobrado y el saldo de cada liquidación.

**Hallazgos de las Bases y Condiciones que cambian specs:**

- Los pagos son informales (PIX, transferencia, Mercado Pago, efectivo): la plataforma no cobra ni valida pagos, calcula el monto y emite una liquidación descargable.
- La asignación de hotel sigue el orden de inscripción y primer pago: es una regla configurable por evento.
- Hay géneros restringidos a ciertas categorías (Composições Coreográficas solo 40+; Reggaeton desde Infantil) y un Quadro de hasta 10 minutos que cuesta como dos coreografías.
- Las notas y comentarios del jurado quedan disponibles para los dirigentes tras los resultados (Art. 32). El spec F3-01 hoy los deja solo para el Director Técnico: hay que corregirlo.
- La edad se toma completa al día del evento, por eso la categoría se calcula por evento y no una vez por bailarín.

## 4. Idiomas: español y portugués

Toda la plataforma funciona en español y portugués desde la etapa 1: agregar idiomas después obliga a revisar cada pantalla, email y PDF. El reglamento del evento de referencia ya se publica en ambos idiomas.

| Capa | Qué incluye | Cómo se resuelve |
| --- | --- | --- |
| Interfaz | Menús, botones, formularios, mensajes de validación del reglamento | next-intl con `es` y `pt-BR`, rutas `/es` y `/pt`, selector visible, idioma guardado en el perfil |
| Contenido del organizador | Nombres de eventos, reglamento, géneros, categorías, campos adicionales, premios, comunicados | Columnas traducibles `{ es, pt }` editadas lado a lado; si falta una traducción se muestra el idioma por defecto del evento y el panel la marca como pendiente |
| Salidas | Emails, orden del día, certificados, credenciales, mensajes | Se generan en el idioma de cada destinatario |
| Formatos | Fechas, horas, montos | Formato del idioma elegido; hora en la zona horaria de la sede; moneda del evento (BRL, ARS, USD) |
| Datos de usuarios | Nombres de academias, coreografías y bailarines | No se traducen |

**Glosario de interfaz (propuesta a validar con el organizador):**

| Código y español | Portugués |
| --- | --- |
| Ficha | Ficha de inscrição |
| Bailarín / Bailarina | Bailarino / Bailarina |
| Coreografía | Coreografia |
| Categoría | Categoria |
| Género | Gênero |
| Solista, Dúo, Trío, Grupo | Solo, Duo, Trio, Grupo |
| Pista | Palco |
| Orden de salida | Ordem de apresentação |
| Jurado | Jurado (Júri) |
| Acreditación | Credenciamento |
| Selectivo | Seletiva |

**Reglas:** el código mantiene los nombres de dominio en español; ningún texto visible se escribe fijo en un componente; CI falla si una clave existe en un idioma y no en el otro. Opcional: traducción asistida por IA en el panel admin para el contenido del organizador, siempre con revisión humana antes de publicar.

## 5. Cambios de arquitectura respecto al paquete de specs

El paquete actual asume NestJS + Redis + Socket.io + S3 + BullMQ corriendo en un servidor propio. Vercel es serverless: no mantiene conexiones WebSocket persistentes ni procesos en segundo plano. Por eso el stack se simplifica a **Next.js full-stack en Vercel + Supabase como backend gestionado**. La Clean Architecture y el Result Pattern se mantienen intactos.

| Pieza | Paquete actual | Plan nuevo | Motivo |
| --- | --- | --- | --- |
| API | NestJS separado | Next.js Route Handlers + Server Actions | Un solo deploy en Vercel |
| Base de datos | PostgreSQL + Prisma | Supabase Postgres + migraciones SQL versionadas | RLS nativo, tipos generados, un proyecto por cliente |
| Acceso a datos | Prisma Client | Cliente Supabase tipado (`supabase gen types`) detrás de repositorios | Mantiene la interfaz `IFichaRepository` |
| Auth | Auth.js + JWT propio | Supabase Auth (email, Google, magic link para jurados) | Menos código de seguridad propio |
| Autorización | Guards de NestJS | RLS en Postgres + checks en casos de uso | Defensa en profundidad |
| Tiempo real | Socket.io + Redis | Supabase Realtime (Broadcast + Postgres Changes) | Funciona con Vercel serverless |
| Archivos | S3 / MinIO | Supabase Storage (buckets privados + URLs firmadas) | Mismo proyecto, mismas políticas |
| Jobs y colas | BullMQ | Supabase Queues (pgmq) + pg\_cron + Edge Functions | ZIP de música, emails masivos, recordatorios |
| Email | Resend | Resend (sin cambios) | — |
| Monorepo | Turborepo (web, api, admin) | Turborepo más liviano (una app `web` + packages) | Menos piezas que desplegar |

**Lo que no cambia:** capas domain → application → interface → infrastructure, Zod compartido, GLOSARIO, specs funcionales, reglas de código y de testing.

**Cambio de diseño obligatorio:** las reglas del reglamento (Art. 5, 6, 14, 15, 33) hoy están pensadas como constantes en `packages/domain/src/reglas/`. Para vender a otras organizaciones pasan a ser una entidad `ReglamentoEvento` configurable, y el dominio valida contra esa configuración. Los valores del Encuentro de Danzas quedan como preset por defecto.

**Consecuencia sobre el paquete:** el 30/09/2026 se eliminaron los documentos atados al stack anterior (reglas de Cursor, prompts, `STACK_DECISION`, `CLEAN_ARCHITECTURE`, `DATABASE_SCHEMA`, `AGENT_WORKFLOW`, `ENVIRONMENT_SETUP`, `OBSERVABILITY`, instrucciones del proyecto y los specs F1-00, F1-01, F1-02, F1-04, F2-01 y F4-01). La etapa 0 los reescribe sobre este plan, junto con ADR-0002 (Vercel + Supabase), ADR-0003 (single-tenant multi-instancia), ADR-0004 (temporada y eventos) y ADR-0005 (idiomas).

## 6. Infraestructura y flujo de deploy

GitHub es la fuente de verdad; cada push dispara un deploy automático en Vercel, que lee y escribe en Supabase. Hostinger solo aporta el dominio, apuntado por DNS a Vercel.

*[Diagrama en la versión viva: Claude Code → GitHub (soed-core) → deploy automático a una instancia aislada por cliente, cada una con dominio (DNS en Hostinger), proyecto Vercel y Supabase staging + prod.]*

Cada cliente tiene su dominio, su proyecto de Vercel y su proyecto de Supabase; todos se alimentan del mismo repo.

| Servicio | Rol | Qué se configura una sola vez |
| --- | --- | --- |
| GitHub | Repo `soed-core`, PRs, CI (lint, tipos, tests) | Repo privado, protección de `main`, secrets de CI |
| Vercel | Hosting de Next.js, previews por PR, producción desde `main` | Integración con GitHub, variables de entorno, dominio |
| Supabase | Postgres, Auth, Storage, Realtime, Queues, Edge Functions | Dos proyectos por cliente: `staging` y `prod` |
| Hostinger | Registro del dominio y DNS | Registros A/CNAME hacia Vercel; mail del dominio sigue en Hostinger |
| Resend | Emails transaccionales | Dominio verificado (SPF/DKIM en DNS de Hostinger) |

**Entornos:**

| Entorno | Rama | URL | Supabase |
| --- | --- | --- | --- |
| Local | cualquiera | `localhost:3000` | Supabase CLI local (Docker) |
| Preview | cada PR | `soed-*.vercel.app` | Proyecto `staging` |
| Producción | `main` | `app.dominiodelcliente.com` | Proyecto `prod` |

**Flujo de un cambio:** rama `feature/F1-03` → PR → CI verde → preview en Vercel contra `staging` → revisión → merge a `main` → migraciones aplicadas a `prod` por GitHub Action → deploy de producción.

**Migraciones:** viven en `supabase/migrations/` del repo y nunca se editan a mano en el dashboard de producción. Un GitHub Action ejecuta `supabase db push` contra el proyecto del entorno antes del deploy.

**DNS en Hostinger (una vez por cliente):** registro `A` del dominio raíz hacia la IP de Vercel, o `CNAME` de `app` hacia `cname.vercel-dns.com`. Si el cliente trae su propio dominio, se hace lo mismo en su proveedor. Los valores exactos se toman del panel de dominios de Vercel en el momento de configurarlo.

## 7. Estructura del repositorio y capa de personalización

Un solo repo `soed-core` contiene el producto; lo que cambia por cliente vive en `clients/<slug>/` y se selecciona con la variable `SOED_CLIENT` en cada proyecto de Vercel.

```
soed-core/
├── apps/
│   └── web/                      # Next.js 15: UI + Route Handlers + Server Actions
│       └── src/
│           ├── app/              # rutas por rol: (auth) (profesor) (admin) (jurado) (vivo) (publico)
│           ├── modules/          # por dominio: inscripciones, musica, orden, puntajes...
│           │   └── <modulo>/
│           │       ├── application/     # casos de uso + interfaces
│           │       ├── infrastructure/  # repositorios Supabase, Resend, Storage
│           │       └── interface/       # server actions, route handlers, componentes
│           └── lib/              # cliente Supabase, config del cliente, realtime
├── packages/
│   ├── domain/                   # entidades, value objects, reglas (sin dependencias externas)
│   ├── shared-types/             # schemas Zod compartidos
│   ├── ui/                       # componentes shadcn + tokens de tema
│   └── email-templates/          # React Email
├── supabase/
│   ├── migrations/               # SQL versionado (esquema + RLS + funciones)
│   ├── functions/                # Edge Functions (ZIP de música, colas)
│   └── seed.sql                  # datos base neutros
├── clients/
│   ├── _template/                # plantilla para un cliente nuevo
│   └── encuentro-danzas/         # primer cliente
│       ├── client.config.ts      # marca, dominio, módulos activos, textos
│       ├── theme.css             # tokens de color y tipografía
│       ├── assets/               # logo, favicon, imágenes
│       └── seed.sql              # reglamento, categorías, géneros y criterios del cliente
├── docs/  architecture/  specs/  # el paquete de specs actual
├── CLAUDE.md                     # instrucciones persistentes para Claude Code
└── .github/workflows/            # CI + migraciones por entorno
```

**Qué va en `client.config.ts`** (validado con Zod al arrancar, el deploy falla si está incompleto):

| Clave | Ejemplo | Uso |
| --- | --- | --- |
| `nombre` | Encuentro de Danzas | Títulos, emails, PDFs |
| `dominio` | app.encuentrodanzas.com | Links en emails y QR |
| `modulos` | `{ acreditacion: true, entradas: false }` | Feature flags: rutas y menús se ocultan |
| `idiomas` | `['es', 'pt']` | Textos de la UI |
| `emailRemitente` | inscripciones@encuentrodanzas.com | Resend |
| `reglamentoPreset` | `encuentro-2026` | Reglamento inicial de cada temporada nueva |

**Qué NO va en configuración:** lógica. Si un cliente necesita un comportamiento distinto, se generaliza en el Core detrás de un parámetro y todos los clientes lo heredan apagado por defecto.

## 8. Workflow con Claude Code

Claude Code trabaja sobre el repo con el mismo ciclo Spec-Driven del paquete, pero con acceso directo a terminal, Git y los servicios conectados.

**Configuración inicial del repo:**

- `CLAUDE.md` en la raíz: reemplaza a `.cursor/rules/`. Contiene stack, capas, patrones, glosario resumido y comandos (`pnpm test`, `supabase db reset`). Claude Code lo lee en cada sesión.
- `.claude/commands/`: comandos propios reutilizables, por ejemplo `/spec F1-03` (leer spec, resumir, plan, esperar OK), `/review` (checklist de CONTRIBUTING) y `/nuevo-cliente <slug>`.
- Servidores MCP: Supabase (migraciones, SQL, tipos, logs), Vercel (deploys, variables, dominios, logs) y GitHub (PRs, issues).
- Permisos: Claude Code puede correr tests, lint y migraciones locales sin preguntar; push, merge y cualquier acción sobre `prod` requieren tu aprobación.

**Ciclo por spec:**

1. Abrís una rama: `feature/F1-03-inscripcion-ficha`.
2. `/spec F1-03`: Claude Code resume, lista archivos y dudas. No escribe código.
3. Aprobás el plan (o lo corregs).
4. Implementa por capas: migración + RLS → dominio + tests → casos de uso + tests → interfaz → UI.
5. Corre `pnpm lint && pnpm type-check && pnpm test` hasta verde.
6. `/review`: autorevisión contra el Definition of Done.
7. Abre el PR; Vercel genera el preview contra `staging`.
8. Probás el preview y aprobás el merge.

**Reglas para no perder control:**

- Una sesión de Claude Code por spec; `/clear` al terminar.
- Nada de acciones sobre `prod` desde Claude Code sin confirmación explícita.
- Toda decisión de arquitectura nueva se escribe como ADR antes de implementarse.
- Los secretos (service role de Supabase, API keys) solo viven en Vercel y en `.env.local`, nunca en el repo ni en el chat.

## 9. Plan por etapas

Diez etapas; cada una termina desplegada en producción con un criterio de salida verificable. La etapa 3 incluye la configuración de eventos, porque sin ella no hay a qué inscribirse. Urgencia: en 2026 las inscripciones de la final abrieron el 10/08/2025; si 2027 repite ese calendario ya están abiertas, así que el primer piloto real conviene que sea un selectivo.

| Etapa | Contenido | Specs | Estimación | Criterio de salida |
| --- | --- | --- | --- | --- |
| 0. Replanteo (completa el 01/10/2026) | ADR-0002 a ADR-0005; reescribir los documentos eliminados; `CLAUDE.md`; glosario bilingüe | arquitectura + F1-00, F1-01, F1-02, F1-04, F2-01, F4-01 | 1 semana | El paquete no contradice este plan y cada spec pasa el Definition of Ready |
| 1. Fundación | Monorepo, CI, Supabase staging y prod, Vercel conectado a GitHub, dominio en Hostinger, `client.config`, tema, i18n `es` y `pt-BR` | F1-00 | 1–1,5 semanas | Una página con la marca del cliente responde en su dominio con HTTPS, en español y portugués |
| 2. Dominio y datos | Temporada, Evento, Sede, Coreografia, Ficha, Pase; `ReglamentoEvento` con preset 2026; campos traducibles; migraciones, RLS y seed del cliente | F1-01 | 2 semanas | 90% de cobertura en `domain`; tests de RLS; el preset valida lo mismo que las Bases y Condiciones 2026 |
| 3. Eventos e inscripciones (MVP) | Panel para crear temporada y eventos (clonar, sede, fechas, reglamento, precios); auth; academias; coreografías reutilizables; fichas con validación en vivo; música; tarifario, liquidación descargable y registro de cobros; panel del profesor; emails bilingües; campos adicionales | F1-02 a F1-06 + spec nuevo de eventos | 5–6 semanas | Piloto: 3–5 academias reales se inscriben a un evento que configuró el organizador, sin asistencia |
| 4. Orden en vivo | Constructor de orden, Realtime, vistas de coordinador, locutor y DJ, multi-pista | F2-00 a F2-03 | 3–4 semanas | Un reorden se ve en 4 dispositivos en menos de 1 segundo |
| 5. Puntajes y pases | Criterios, planilla del jurado offline, Director Técnico, ranking, premios, notas visibles a dirigentes, pases a la final | F3-00 a F3-03 + parte de F7-02 | 3–4 semanas | Simulacro: 20 coreografías y 3 jurados; ranking y pases correctos sin intervención manual |
| 6. Admin avanzado | Dashboard por evento y por temporada, exportaciones, comunicados por evento e idioma, audit log, solicitudes de modificación | F4-00 a F4-03 | 2–3 semanas | El organizador opera una semana sin pedir datos por fuera del sistema |
| 7. Acreditación | QR por bailarín y evento, cobro en la mesa escaneando la liquidación, cierre de caja, credenciales PDF bilingües, escáner offline, zonas | F5-00 | 2 semanas | 100 acreditaciones de prueba en menos de 15 minutos con 2 celulares |
| 8. Clases y entradas | Catálogo, cupos, venta pública, pagos en la moneda de cada evento | F6-00 | 3 semanas | Compra real de punta a punta en modo producción de la pasarela |
| 9. PWA y productización | Instalable, push, UX móvil, plantilla `clients/_template`, playbook de alta | F7-00 a F7-03 | 2 semanas | Un segundo cliente de prueba se levanta en menos de un día |

**Total estimado:** 25–32 semanas de trabajo con Claude Code, trabajando solo; el modelo multi-evento y los dos idiomas suman unas 3 semanas al plan anterior. La app nativa (F8) queda fuera hasta tener datos de uso reales de la PWA.

**Etapas que pueden adelantarse:** la 7 (acreditación) y la 8 (entradas) no dependen de puntajes; si el cliente las prioriza sobre el admin avanzado, se intercambian con la 6.

## 10. Playbook: alta de una nueva organización

Objetivo al terminar la etapa 9: levantar un cliente nuevo en menos de un día, sin tocar código del Core. Claude Code lo ejecuta con `/nuevo-cliente <slug>` y vos aprobás cada paso que crea recursos pagos.

1. **Relevamiento:** reglamento del cliente (categorías, edades, tolerancias, tiempos, géneros, criterios, premios), marca y módulos contratados.
2. **Configuración:** copiar `clients/_template` a `clients/<slug>`, completar `client.config.ts`, `theme.css`, assets y `seed.sql` con su reglamento.
3. **Supabase:** crear proyectos `<slug>-staging` y `<slug>-prod`, aplicar migraciones y seed.
4. **Vercel:** crear proyecto `soed-<slug>` desde el mismo repo, `SOED_CLIENT=<slug>` y variables de Supabase y Resend.
5. **Dominio:** DNS en Hostinger o en el proveedor del cliente; verificar dominio de email en Resend.
6. **Validación:** smoke test del flujo inscripción → orden → puntaje sobre staging.
7. **Entrega:** alta del Super Admin del cliente, capacitación y manual de uso.

**Actualizaciones:** un merge a `main` del Core se despliega a todas las instancias. Las migraciones se aplican a cada proyecto Supabase de producción desde un workflow que recorre la lista de clientes. Antes de cada release, se prueba en el staging del cliente con evento más próximo.

**Regla operativa:** nunca desplegar una migración destructiva a un cliente que tiene un evento en curso. El workflow consulta las fechas de los eventos activos y lo bloquea.

## 11. Riesgos, decisiones pendientes y próximos pasos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Costo de N instancias: Supabase Free pausa proyectos inactivos y limita cantidad | Un cliente en producción no puede quedar en plan Free | Producción de cada cliente en plan pago; staging puede ser Free o un branch de Supabase. Trasladar el costo al abono mensual |
| Picos el día del evento (cientos de conexiones Realtime simultáneas) | Retrasos en orden y puntajes | Prueba de carga en la etapa 5; revisar límites de conexiones del plan antes de cada evento |
| WiFi del venue inestable | Jurado o acreditación bloqueados | Modo offline de jurado en la etapa 5 y de acreditación en la 7, no en la 9 |
| Divergencia entre clientes | El Core se llena de excepciones | Regla de configuración + ADR por cada parámetro nuevo |
| Datos personales de menores (DNI, fecha de nacimiento) | Riesgo legal y reputacional | RLS estricta, buckets privados, logs sin datos sensibles, términos y política de privacidad por cliente |
| Timeouts de funciones en Vercel para tareas largas | ZIP de música o envíos masivos fallan | Esas tareas van a colas y Edge Functions de Supabase, nunca a un Route Handler |

**Decisiones que necesito de vos antes de la etapa 1:**

- [ ] Calendario de la temporada 2027: cuántos selectivos, en qué países y fechas, y cuál es el primero que puede usar la plataforma.
- [ ] Si habrá venta de entradas con pago en línea (hoy la plataforma no cobra; clases y entradas se reservan con cobro manual).
- [ ] Dominio de SOED (marca propia para ventas y demo) y dominio del primer cliente.
- [ ] Plan de Supabase y Vercel para producción (costo mensual que vas a trasladar al cliente).
- [ ] Validar con el organizador el glosario de interfaz en portugués.

**Próximos pasos:**

1. Revisás este plan y respondés las decisiones de arriba.
2. Ejecutamos la etapa 0: ADR-0002 a ADR-0005, documentos y specs reescritos, glosario bilingüe y `CLAUDE.md`.
3. Abrís Claude Code en el repo nuevo, conectás los servidores MCP de GitHub, Supabase y Vercel, y arrancamos la etapa 1.
