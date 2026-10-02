# Matriz de trazabilidad

> Generada por `pnpm trace` (scripts/trazabilidad.mjs) a partir de `docs/auditoria/inventario.csv` y de las etiquetas `[ID]` en las pruebas. No editar a mano.

**Cobertura por pruebas:** 178 de 207 funcionalidades (86 %).

| Área | Funcionalidades | Con pruebas | % | Dominio | Aplicación | RLS/SQL | Integración | E2E |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Super Admin | 18 | 17 | 94 | 4 | 5 | 6 | 2 | 9 |
| Organizador | 54 | 53 | 98 | 19 | 16 | 23 | 10 | 33 |
| Profesor/Academia | 33 | 28 | 85 | 3 | 7 | 18 | 5 | 15 |
| Jurado | 10 | 7 | 70 | 1 | 4 | 3 | 4 | 5 |
| Operativos | 25 | 23 | 92 | 11 | 9 | 13 | 7 | 17 |
| Sitio público | 15 | 14 | 93 | 0 | 2 | 7 | 2 | 14 |
| Transversal | 52 | 36 | 69 | 21 | 13 | 17 | 7 | 11 |

Leyenda de niveles: D = dominio, A = aplicación (casos de uso), S = RLS/SQL (pgTAP), I = integración (PostgREST real), E = e2e (Playwright + axe).

## Super Admin

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| SA-01 | Crear y editar temporadas (año, nombre es/pt, reglamento por defecto) | eventos | temporada · rls: escritura solo super admin; lectura pública si publicada | /admin/temporadas | E |
| SA-02 | Crear eventos (selectivo, final o evento único) dentro de una temporada | eventos | evento · rls: insert solo super admin | /admin/eventos/nuevo | A · R · I · E |
| SA-03 | Clonar la configuración de un evento anterior (reglamento, tarifario, criterios, pistas, premios) | eventos | evento, reglamento, tarifario, criterio, pista · fn clonar_evento (security definer, solo super admin) | /admin/eventos/nuevo | A · I · E |
| SA-04 | Crear y administrar usuarios organizadores por evento (rol ORGANIZADOR_EVENTO) | identidad | evento_miembro · rls: escritura super admin u organizador con permiso evento.miembros | /admin/usuarios | R |
| SA-05 | Asignar un mismo organizador a más de un evento _(derivada)_ | identidad | evento_miembro (PK evento_id+usuario_id+rol) | /admin/usuarios | R |
| SA-06 | Revocar el acceso de un organizador o miembro de evento _(inferida)_ | identidad | evento_miembro · auditoria | /admin/usuarios | E |
| SA-07 | Gestionar el reglamento de temporada desde un preset y versionarlo | reglamento | reglamento (config jsonb validada) · rls: escritura super admin | /admin/temporadas/[id]/reglamento | E |
| SA-08 | Crear premios globales a la temporada o propios de un evento | premios | premio (evento_id nullable) · rls: super admin; organizador solo los de su evento | /admin/premios | D |
| SA-09 | Definir criterio de asignación de premios (manual o por ranking) y regla de empate | premios | premio.criterio · premio.regla_empate | /admin/premios | D |
| SA-10 | Ver total esperado y cobrado por temporada | liquidaciones | vista v_resumen_cobranza (security invoker) | /admin | A · E |
| SA-11 | Dashboard por temporada con métricas por evento | admin | vistas agregadas | /admin | A · E |
| SA-12 | Consultar y filtrar el audit log de toda la instancia | auditoria | auditoria · rls: select super admin; sin update/delete | /admin/auditoria | R |
| SA-13 | Alta y baja de Super Admins solo por canal privilegiado (CLI o service role) _(inferida)_ | identidad | rol_global · rls: sin escritura para authenticated | — | R |
| SA-14 | Configurar marca, módulos e idiomas de la instancia (client.config) | plataforma | clients/<slug>/client.config.ts (Zod) | — | — |
| SA-15 | Ver el historial de resultados y pases de academias y coreografías en la temporada | resultados | resultado · pase | /admin/temporadas/[id]/historial | A · E |
| SA-16 | Gestionar catálogo de categorías, géneros y formaciones del reglamento (traducibles) | reglamento | reglamento.config | /admin/temporadas/[id]/reglamento | D |
| SA-17 | Archivar un evento finalizado (solo lectura) _(inferida)_ | eventos | evento.estado = ARCHIVADO · trigger bloquea escritura | /admin/eventos | D · R |
| SA-18 | Exportar datos de la temporada (CSV) | exportaciones | route handler con verificación de permiso | /admin/exportaciones | E |

## Organizador

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| OR-01 | Editar datos generales del evento (nombre es/pt, tipo, estado, idioma por defecto) | eventos | evento · rls: update con permiso evento.configurar | /gestion/[eventoId]/configuracion | R |
| OR-02 | Configurar sede y fechas (venue, ciudad, estado o provincia, país, zona horaria, fechas) | eventos | evento.sede (jsonb) · evento.zona_horaria | /gestion/[eventoId]/configuracion | D · R |
| OR-03 | Configurar ventana de inscripción (apertura, cierre, cierre de modificaciones) y cupos | eventos | evento.inscripcion_* · evento.cupo_fichas | /gestion/[eventoId]/configuracion | D · R |
| OR-04 | Ajustar el reglamento del evento (categorías y edades, tolerancias, géneros por categoría, tiempos, tamaño de grupo, umbrales) | reglamento | evento.reglamento (snapshot versionado) · rls: permiso evento.configurar | /gestion/[eventoId]/reglamento | E |
| OR-05 | Configurar la moneda del evento (BRL / ARS / USD) | eventos | evento.moneda (check) | /gestion/[eventoId]/configuracion | E |
| OR-06 | Configurar tarifario: por bailarín, por coreografía (precio por formación), por participación, monto fijo, rubros opcionales y recargos | liquidaciones | evento.tarifario (jsonb validada) | /gestion/[eventoId]/tarifario | D |
| OR-07 | Configurar datos de pago informativos que muestra la liquidación | liquidaciones | evento.datos_pago (jsonb {es pt}) | /gestion/[eventoId]/tarifario | E |
| OR-08 | Configurar medios de cobro aceptados (efectivo, Mercado Pago, transferencia, PIX u otros) | cobros | evento.medios_cobro | /gestion/[eventoId]/tarifario | R |
| OR-09 | Configurar paquetes y hoteles con regla de asignación (orden de inscripción y primer pago) y cupo | hoteles | hotel · hotel_solicitud | /gestion/[eventoId]/hoteles | R · E |
| OR-10 | Configurar premios del evento con monto y regla de empate | premios | premio | /gestion/[eventoId]/premios | A · E |
| OR-11 | Configurar pistas (varias en paralelo) | orden | pista · rls: permiso evento.configurar | /gestion/[eventoId]/configuracion | E |
| OR-12 | Asignar jurados, director técnico y staff (coordinador, locutor, DJ, acreditación) | identidad | evento_miembro · rls: permiso evento.miembros | /gestion/[eventoId]/equipo | R |
| OR-13 | Configurar criterios de puntaje (nombre es/pt, peso, escala) | puntajes | criterio | /gestion/[eventoId]/puntajes | E |
| OR-14 | Configurar el cronograma (bloques por pista y horario) | orden | bloque | /gestion/[eventoId]/orden | E |
| OR-15 | Configurar horario y zonas de acreditación | acreditacion | evento.acreditacion (jsonb) | /gestion/[eventoId]/configuracion | D · E |
| OR-16 | Configurar campos adicionales de inscripción, ficha o bailarín | inscripciones | campo_adicional · datos_adicionales jsonb | /gestion/[eventoId]/campos | D · A · R · E |
| OR-17 | Publicar o despublicar el evento en el sitio público _(inferida)_ | eventos | evento.publicado · rls: anon solo ve publicados | /gestion/[eventoId]/configuracion | R |
| OR-18 | Editar contenido traducible lado a lado y ver traducciones pendientes | i18n | columnas jsonb {es pt} | /gestion/[eventoId]/configuracion | D · E |
| OR-19 | Ver academias inscriptas con estado y totales | inscripciones | inscripcion · rls: permiso inscripciones.ver | /gestion/[eventoId]/inscripciones | E |
| OR-20 | Ver, filtrar y buscar fichas por estado, categoría, género y formación _(inferida)_ | inscripciones | ficha (índices evento_id+estado) | /gestion/[eventoId]/fichas | E |
| OR-21 | Observar o aprobar una ficha con comentario _(inferida)_ | inscripciones | ficha.estado · rls: permiso inscripciones.gestionar | /gestion/[eventoId]/fichas | A · R · I · E |
| OR-22 | Registrar una excepción de reglamento con motivo (auditada) _(inferida)_ | inscripciones | ficha.excepcion · auditoria | /gestion/[eventoId]/fichas | A · I |
| OR-23 | Bloquear o desbloquear modificaciones de fichas tras el cierre | inscripciones | ficha.bloqueada · trigger | /gestion/[eventoId]/fichas | A · R · I |
| OR-24 | Gestionar solicitudes de modificación de las academias | inscripciones | solicitud_modificacion | /gestion/[eventoId]/solicitudes | E |
| OR-25 | Fijar monto libre o sin cargo para una academia (becas, invitados) | liquidaciones | inscripcion.ajuste (jsonb) | /gestion/[eventoId]/liquidaciones | D · E |
| OR-26 | Ver la liquidación de cada academia con historial de versiones | liquidaciones | liquidacion · liquidacion_version · rls: permiso liquidaciones.ver | /gestion/[eventoId]/liquidaciones | R |
| OR-27 | Ver total esperado por academia y por evento | liquidaciones | vista v_resumen_cobranza | /gestion/[eventoId] | E |
| OR-28 | Registrar un cobro (monto propuesto = saldo, medio, referencia, nota) | cobros | cobro · rls: permiso cobros.registrar | /gestion/[eventoId]/cobros | D · A · R · I · E |
| OR-29 | Aceptar pagos parciales y varios cobros por liquidación | cobros | cobro (n por liquidación) | /gestion/[eventoId]/cobros | D · R · I · E |
| OR-30 | Anular un cobro con motivo, nunca borrarlo | cobros | cobro.anulado_* · sin policy delete · trigger anti-delete | /gestion/[eventoId]/cobros | D · A · R · I |
| OR-31 | Cierre de caja por turno: total por medio y por persona | cobros | turno_caja · vista v_caja | /gestion/[eventoId]/caja | D · A |
| OR-32 | Buscar una liquidación por QR, número o academia | liquidaciones | liquidacion.numero (unique) · liquidacion_version.qr_token | /gestion/[eventoId]/cobros | E |
| OR-33 | Registrar un pase manual (coreografía o academia) con motivo, autor y fecha | pases | pase · rls: permiso pases.registrar | /gestion/[eventoId]/pases | D · A · R · I |
| OR-34 | Registrar el beneficio opcional del pase (descuento o beca) | pases | pase.beneficio (jsonb) | /gestion/[eventoId]/pases | D · A |
| OR-35 | Ver la lista por puesto como ayuda para decidir pases | resultados | resultado | /gestion/[eventoId]/pases | D |
| OR-36 | Anular un pase con motivo _(inferida)_ | pases | pase.anulado_* | /gestion/[eventoId]/pases | R |
| OR-37 | Generar el orden de salida por pista y bloque | orden | orden_item | /gestion/[eventoId]/orden | D · A · I |
| OR-38 | Reordenar manualmente con propagación en tiempo real | orden | orden_item · realtime publication | /gestion/[eventoId]/orden | D · R |
| OR-39 | Publicar el orden de salida para academias y público _(inferida)_ | orden | evento.orden_publicado_at | /gestion/[eventoId]/orden | E |
| OR-40 | Exportar o imprimir el orden del día en el idioma elegido | orden | route handler PDF/CSV | /gestion/[eventoId]/orden | E |
| OR-41 | Calcular el ranking por categoría, formación y género | resultados | resultado · fn calcular_resultados | /gestion/[eventoId]/resultados | D · A · I · E |
| OR-42 | Publicar resultados, lo que habilita notas y comentarios a los dirigentes (Art. 32) | resultados | evento.resultados_publicados_at · rls condicionada | /gestion/[eventoId]/resultados | R · E |
| OR-43 | Asignar premios (manual o por ranking); el empate divide el monto | premios | premio_asignacion | /gestion/[eventoId]/premios | D · A · E |
| OR-44 | Generar certificados bilingües | documentos | storage documentos (privado) | /gestion/[eventoId]/resultados | E |
| OR-45 | Dashboard del evento (inscripciones, cobranza, fichas por estado, música faltante) | admin | vistas agregadas | /gestion/[eventoId] | E |
| OR-46 | Exportar academias, bailarines, fichas, cobros y puntajes (CSV) | exportaciones | route handler con permiso exportar.datos | /gestion/[eventoId]/exportaciones | A · E |
| OR-47 | Enviar comunicados por evento e idioma (email) | comunicados | comunicado · email_envio · pgmq | /gestion/[eventoId]/comunicados | A · I |
| OR-48 | Ver el audit log del evento | auditoria | auditoria · rls: permiso auditoria.ver | /gestion/[eventoId]/auditoria | R |
| OR-49 | Descargar un ZIP de música por bloque o pista | musica | Edge Function + pgmq · storage musica | /gestion/[eventoId]/orden | A · E |
| OR-50 | Enviar recordatorios automáticos (cierre de inscripción, música faltante) | comunicados | pg_cron + pgmq | — | — |
| OR-51 | Gestionar clases (catálogo, cupos, precios) | clases | clase | /gestion/[eventoId]/clases | R · E |
| OR-52 | Gestionar entradas (tipos, cupos, precios) y reservas | entradas | entrada_tipo · reserva_entrada | /gestion/[eventoId]/entradas | R · E |
| OR-53 | Registrar el cobro manual de clases y entradas | entradas | reserva_*.estado_pago | /gestion/[eventoId]/entradas | R · E |
| OR-54 | Ver la asignación de hotel según orden de inscripción y primer pago | hoteles | hotel_solicitud · vista v_hotel_prioridad | /gestion/[eventoId]/hoteles | D · R · E |

## Profesor/Academia

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| PR-01 | Registrarse e iniciar sesión (email y contraseña, Google o magic link) | identidad | auth.users · perfil (trigger alta) | /ingresar · /registro | — |
| PR-02 | Elegir idioma y guardarlo en el perfil | i18n | perfil.idioma | selector global | — |
| PR-03 | Crear y editar el perfil de la academia | academias | academia · rls: miembros de la academia | /academia/perfil | R · E |
| PR-04 | Invitar a otros profesores a la academia _(inferida)_ | academias | academia_miembro | /academia/perfil | R · E |
| PR-05 | Cargar bailarines una vez para toda la temporada (nombre, fecha de nacimiento, documento) | academias | bailarin · rls: miembros de su academia; organizador ve los inscriptos a su evento | /academia/bailarines | R |
| PR-06 | Editar o dar de baja bailarines _(inferida)_ | academias | bailarin.activo | /academia/bailarines | E |
| PR-07 | Crear coreografías reutilizables (nombre, género, formación, elenco, música) | coreografias | coreografia · coreografia_bailarin | /academia/coreografias | E |
| PR-08 | Subir música con validación de formato y duración | musica | storage musica (privado, políticas por academia) | /academia/coreografias/[id] | R |
| PR-09 | Inscribir la academia a un evento | inscripciones | inscripcion · rls: miembros de la academia, evento con inscripción abierta | /academia/eventos/[eventoId] | E |
| PR-10 | Inscribir una coreografía al evento en un clic, reutilizando elenco y música | inscripciones | ficha · ficha_bailarin (snapshot) | /academia/eventos/[eventoId] | R · I |
| PR-11 | Ver la categoría calculada de cada bailarín a la fecha del evento | reglamento | ficha_bailarin.edad · categoria | /academia/eventos/[eventoId] | E |
| PR-12 | Validación en vivo de la ficha (categoría, tolerancia 30 %, tiempo, género habilitado, tamaño de grupo) | reglamento | ficha.validacion (jsonb) | /academia/eventos/[eventoId]/fichas/[fichaId] | D · A · R · I · E |
| PR-13 | Ver el total de la liquidación recalculado en vivo | liquidaciones | cálculo en dominio | /academia/eventos/[eventoId]/liquidacion | A · I · E |
| PR-14 | Seleccionar rubros opcionales | liquidaciones | inscripcion.rubros (jsonb) | /academia/eventos/[eventoId]/liquidacion | E |
| PR-15 | Descargar la liquidación en PDF en su idioma, con número, QR y aclaración de que no es factura | documentos | liquidacion_version · storage documentos | /academia/eventos/[eventoId]/liquidacion | A · I · E |
| PR-16 | Ver el historial de versiones de la liquidación | liquidaciones | liquidacion_version | /academia/eventos/[eventoId]/liquidacion | R |
| PR-17 | Ver lo cobrado y el saldo de cada liquidación | cobros | vista v_liquidacion_estado | /academia/eventos/[eventoId]/liquidacion | R |
| PR-18 | Completar los campos adicionales del evento | inscripciones | datos_adicionales jsonb | /academia/eventos/[eventoId] | D · A · R · E |
| PR-19 | Editar fichas hasta el cierre de modificaciones | inscripciones | ficha · rls + trigger de ventana | /academia/eventos/[eventoId]/fichas/[fichaId] | D · A · R |
| PR-20 | Solicitar una modificación después del cierre | inscripciones | solicitud_modificacion | /academia/eventos/[eventoId]/fichas/[fichaId] | R |
| PR-21 | Retirar una ficha _(inferida)_ | inscripciones | ficha.estado = RETIRADA | /academia/eventos/[eventoId] | A · R |
| PR-22 | Recibir emails transaccionales en su idioma (inscripción, liquidación, cobro, orden, resultados) | comunicados | email_envio · plantillas React Email | — | A · I |
| PR-23 | Ver el orden de salida de sus coreografías | orden | orden_item (si publicado) | /academia/eventos/[eventoId]/orden | R |
| PR-24 | Recibir cambios del orden en tiempo real | orden | realtime orden_item | /academia/eventos/[eventoId]/orden | — |
| PR-25 | Ver resultados, notas y comentarios del jurado tras la publicación (Art. 32) | resultados | planilla, planilla_nota, resultado · rls condicionada a publicación | /academia/eventos/[eventoId]/resultados | R |
| PR-26 | Ver pases recibidos y sus beneficios | pases | pase · rls academia propietaria | /academia | R |
| PR-27 | Reinscribir en la final la coreografía presentada en un selectivo | inscripciones | ficha (coreografia_id reutilizada) | /academia/eventos/[eventoId] | — |
| PR-28 | Descargar las credenciales QR de sus bailarines | acreditacion | credencial · storage documentos | /academia/eventos/[eventoId]/credenciales | R |
| PR-29 | Ver el historial de resultados de la academia en la temporada | resultados | resultado (publicados) | /academia | E |
| PR-30 | Solicitar hotel o paquete | hoteles | hotel_solicitud | /academia/eventos/[eventoId] | R · E |
| PR-31 | Reservar clases para sus bailarines | clases | reserva_clase | /academia/eventos/[eventoId]/clases | R · E |
| PR-32 | Descargar certificados | documentos | storage documentos | /academia/eventos/[eventoId]/resultados | E |
| PR-33 | Ver los comunicados del evento en su panel | comunicados | comunicado (audiencia academias) | /academia | — |

## Jurado

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| JU-01 | Acceder con magic link | identidad | auth magic link · evento_miembro JURADO | /ingresar | — |
| JU-02 | Ver las coreografías a puntuar en el orden de salida en vivo _(inferida)_ | puntajes | orden_item · ficha (campos mínimos) | /jurado/[eventoId] | E |
| JU-03 | Cargar puntajes por criterio con la escala configurada | puntajes | planilla · planilla_nota · rls: jurado dueño | /jurado/[eventoId]/planilla/[fichaId] | D · A · R · I · E |
| JU-04 | Escribir un comentario por coreografía | puntajes | planilla.comentario | /jurado/[eventoId]/planilla/[fichaId] | A |
| JU-05 | Planilla offline: carga sin conexión y sincronización idempotente | puntajes | planilla.client_uuid (unique) | /jurado/[eventoId] | A · I · E |
| JU-06 | Enviar la planilla (bloquea la edición) _(inferida)_ | puntajes | planilla.estado · trigger | /jurado/[eventoId]/planilla/[fichaId] | A · R · I · E |
| JU-07 | Ver solo sus propias planillas _(inferida)_ | puntajes | rls planilla.jurado_id = auth.uid() | /jurado/[eventoId] | R · I |
| JU-08 | Ver los datos técnicos de la coreografía (categoría, género, formación, duración) _(inferida)_ | puntajes | vista v_ficha_jurado | /jurado/[eventoId]/planilla/[fichaId] | E |
| JU-09 | Usar la interfaz en su idioma | i18n | perfil.idioma | global | — |
| JU-10 | Ver en tiempo real qué coreografía está en escena _(inferida)_ | orden | realtime orden_item | /jurado/[eventoId] | — |

## Operativos

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| OP-01 | Director técnico: ver todas las planillas del evento en tiempo real | puntajes | planilla · rls: permiso puntajes.supervisar | /vivo/[eventoId]/director-tecnico | R · E |
| OP-02 | Director técnico: control de desvíos (alerta si un jurado se aparta más del umbral) | puntajes | cálculo en dominio | /vivo/[eventoId]/director-tecnico | D · A · E |
| OP-03 | Director técnico: reabrir la planilla de un jurado con motivo (auditado) _(inferida)_ | puntajes | planilla.estado · auditoria | /vivo/[eventoId]/director-tecnico | R |
| OP-04 | Director técnico: cerrar puntajes de un bloque y disparar el cálculo del ranking _(inferida)_ | resultados | fn calcular_resultados | /vivo/[eventoId]/director-tecnico | — |
| OP-05 | Director técnico: ver el ranking antes de la publicación _(inferida)_ | resultados | resultado · rls: puntajes.supervisar | /vivo/[eventoId]/director-tecnico | E |
| OP-06 | Coordinador: vista en vivo del orden por pista | orden | orden_item | /vivo/[eventoId]/coordinador | A · R · I · E |
| OP-07 | Coordinador: marcar estados (llamada, en escena, presentada, ausente) _(inferida)_ | orden | orden_item.estado · rls: permiso orden.operar | /vivo/[eventoId]/coordinador | D · A · R · I · E |
| OP-08 | Coordinador: reordenar en vivo con propagación en menos de 1 segundo | orden | orden_item · fn reordenar (transaccional) | /vivo/[eventoId]/coordinador | D · R |
| OP-09 | Coordinador: mover una coreografía entre bloques o pistas _(inferida)_ | orden | orden_item.bloque_id | /vivo/[eventoId]/coordinador | D · R |
| OP-10 | Coordinador: ver la hora estimada recalculada _(inferida)_ | orden | cálculo en dominio | /vivo/[eventoId]/coordinador | D |
| OP-11 | Locutor: ver actual, próxima y siguientes con los datos para anunciar, en tiempo real | orden | vista v_orden_vivo | /vivo/[eventoId]/locutor | R · E |
| OP-12 | Locutor: ver los nombres traducibles en el idioma del evento | i18n | jsonb {es pt} | /vivo/[eventoId]/locutor | E |
| OP-13 | DJ: lista de música en orden de salida con reproducción y descarga por ítem | musica | URL firmada (60 s) · rls: permiso musica.descargar | /vivo/[eventoId]/dj | R · E |
| OP-14 | DJ: descargar ZIP de música por bloque, rotulado con número de orden | musica | Edge Function + pgmq | /vivo/[eventoId]/dj | A · E |
| OP-15 | DJ: alerta de música faltante o fuera de tiempo _(inferida)_ | musica | ficha.validacion | /vivo/[eventoId]/dj | E |
| OP-16 | DJ: recibir el reorden en tiempo real | orden | realtime orden_item | /vivo/[eventoId]/dj | — |
| OP-17 | Staff de acreditación: escanear el QR de la credencial y marcar acreditación | acreditacion | credencial · acreditacion_registro · rls: permiso acreditacion.operar | /acreditacion/[eventoId] | D · A · R · I · E |
| OP-18 | Staff de acreditación: buscar por nombre, documento o academia _(inferida)_ | acreditacion | índices de búsqueda | /acreditacion/[eventoId] | R · E |
| OP-19 | Staff de acreditación: escanear la liquidación y ver total, cobrado y saldo | cobros | vista v_liquidacion_estado | /acreditacion/[eventoId]/caja | E |
| OP-20 | Staff de acreditación: registrar cobros en la mesa sin conexión y sincronizar al volver la red | cobros | cobro.client_uuid (unique, idempotente) | /acreditacion/[eventoId]/caja | D · A · R · I · E |
| OP-21 | Staff de acreditación: ver su caja del turno por medio de cobro | cobros | turno_caja · v_caja | /acreditacion/[eventoId]/caja | D · E |
| OP-22 | Escáner de acreditación sin conexión con sincronización | acreditacion | acreditacion_registro.client_uuid | /acreditacion/[eventoId] | A · R · I |
| OP-23 | Emitir credenciales PDF bilingües | documentos | storage documentos | /acreditacion/[eventoId] | D · A · I · E |
| OP-24 | Control de acceso por zonas | acreditacion | credencial.zonas | /acreditacion/[eventoId] | D |
| OP-25 | La acreditación nunca se bloquea por deuda: solo informa el saldo | acreditacion | sin dependencia de cobro en reglas ni triggers | /acreditacion/[eventoId] | D · A · R · I · E |

## Sitio público

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| PU-01 | Rutas /es y /pt con selector de idioma visible | publico | next-intl routing | /es · /pt | E |
| PU-02 | Home con la marca del cliente (logo, colores, tipografía) | publico | clients/<slug> | /[locale] | E |
| PU-03 | Listado de eventos de la temporada _(inferida)_ | publico | evento · rls anon: publicado = true | /[locale]/eventos | R · I · E |
| PU-04 | Detalle del evento: sede, fechas, zona horaria y estado de la inscripción _(inferida)_ | publico | evento | /[locale]/eventos/[slug] | R · E |
| PU-05 | Bases y condiciones del evento en ambos idiomas | publico | evento.bases (jsonb {es pt}) | /[locale]/eventos/[slug] | E |
| PU-06 | Cronograma público _(inferida)_ | publico | bloque (si publicado) | /[locale]/eventos/[slug] | A · R · E |
| PU-07 | Orden de salida público en vivo (si el organizador lo publica) | publico | v_orden_publico (sin datos personales) | /[locale]/eventos/[slug]/orden | R · I · E |
| PU-08 | Resultados publicados _(inferida)_ | publico | v_resultado_publico | /[locale]/eventos/[slug]/resultados | R · E |
| PU-09 | Catálogo y reserva de clases | clases | clase · reserva_clase (insert anon vía server action) | /[locale]/eventos/[slug]/clases | R · E |
| PU-10 | Entradas: tipos, precios y reserva | entradas | entrada_tipo · reserva_entrada | /[locale]/eventos/[slug]/entradas | R · E |
| PU-11 | Textos legales por cliente (términos, privacidad) | publico | clients/<slug>/legal | /[locale]/legal/[doc] | — |
| PU-12 | SEO por idioma (hreflang, metadata, sitemap) _(inferida)_ | publico | metadata API | — | E |
| PU-13 | Accesibilidad WCAG 2.2 AA | publico | — | todas | E |
| PU-14 | PWA instalable (manifest y shell offline) | plataforma | manifest · service worker | — | A · E |
| PU-15 | Acceso a ingreso y registro de academias _(inferida)_ | publico | — | /[locale]/ingresar | E |

## Transversal

| ID | Funcionalidad | Módulo | Datos / RLS | Pantalla | Pruebas |
|---|---|---|---|---|---|
| TR-01 | ReglamentoEvento configurable (sin constantes de reglamento en código) | reglamento | reglamento.config (Zod) | — | D · R |
| TR-02 | Categoría calculada por edad completa a la fecha de referencia del evento | reglamento | dominio puro | — | D |
| TR-03 | Tolerancia de grupos del 30 % (configurable) | reglamento | reglamento.config.tolerancias | — | D |
| TR-04 | Tolerancia de tiempo: 30 s en grupos, 15 s en solo, dúo y trío (configurable) | reglamento | reglamento.config.formaciones | — | D |
| TR-05 | Tiempos máximos por género, formación y categoría (regla más específica gana) | reglamento | reglamento.config.tiempos | — | D |
| TR-06 | Géneros restringidos por categoría (Composições solo 40+, Reggaeton desde Infantil) | reglamento | reglamento.config.generos | — | D |
| TR-07 | Tamaño mínimo y máximo de integrantes por formación | reglamento | reglamento.config.formaciones | — | D |
| TR-08 | Clasificación por bandas 9.0 / 8.0 / 7.0 (configurable) | resultados | reglamento.config.bandas | — | D · A · I |
| TR-09 | Quadro de hasta 10 minutos con recargo equivalente a dos coreografías | liquidaciones | reglamento + tarifario | — | D |
| TR-10 | Preset de reglamento 2026 cargado como seed | reglamento | clients/_template/seed.sql | — | D |
| TR-11 | Versionado del reglamento y revalidación de fichas al cambiar _(inferida)_ | reglamento | evento.reglamento_version · ficha.validacion | — | A · R · E |
| TR-12 | El pago nunca limita la participación (sin bloqueos por deuda) | cobros | sin FK ni trigger de cobro en inscripción/acreditación/orden | — | A · R · I · E |
| TR-13 | Pases manuales: el sistema registra, no decide | pases | pase (sin triggers automáticos) | — | D · A · R · I |
| TR-14 | Resultados y notas visibles solo tras la publicación (Art. 32) | resultados | rls condicionada a evento.resultados_publicados_at | — | R |
| TR-15 | Numeración LIQ-<SLUG>-0001 correlativa por evento, sin duplicados concurrentes | liquidaciones | evento_contador · fn private.siguiente_numero (UPDATE … RETURNING) | — | D · R |
| TR-16 | Eventos independientes: cada organizador administra solo el suyo | identidad | RLS por evento_id en todas las tablas de evento | — | R · E |
| TR-17 | Moneda por evento (BRL / ARS / USD) con formato por idioma | i18n | evento.moneda | — | D · A · R |
| TR-18 | Liquidación: recálculo, versiones y saldo como diferencia | liquidaciones | liquidacion_version | — | D · A · R · E |
| TR-19 | Estados de liquidación (Pendiente, Parcial, Pagada, Sin cargo) derivados, sin efecto bloqueante | liquidaciones | vista v_liquidacion_estado | — | D · R |
| TR-20 | UI en es y pt-BR con next-intl; ningún texto visible en literal | i18n | messages/{es pt} | — | E |
| TR-21 | Contenido del organizador en jsonb {es pt} con fallback al idioma por defecto del evento | i18n | columnas traducibles | — | D · A · I |
| TR-22 | Emails, PDFs, certificados y credenciales en el idioma del destinatario | i18n | perfil.idioma | — | A · I · E |
| TR-23 | Fechas y horas en la zona horaria de la sede; montos en la moneda del evento | i18n | evento.zona_horaria | — | D · A |
| TR-24 | CI falla si falta una clave de traducción | i18n | scripts/i18n-check | — | — |
| TR-25 | Agregar un idioma nuevo sin tocar pantallas (catálogo de idiomas configurable) | i18n | lib/i18n/locales.ts · client.config.idiomas | — | — |
| TR-26 | Traducción asistida por IA con revisión humana (opcional) | i18n | — | /gestion/[eventoId]/configuracion | — |
| TR-27 | RLS habilitada en cada tabla en la misma migración | seguridad | todas las tablas | — | R |
| TR-28 | Pruebas de RLS por rol | seguridad | supabase/tests | — | — |
| TR-29 | Storage privado con URLs firmadas de corta duración | seguridad | storage.objects políticas por bucket | — | R |
| TR-30 | Audit log de cambios sensibles, append-only | auditoria | auditoria · triggers | — | R |
| TR-31 | Validación Zod en el borde (server actions y route handlers) | seguridad | packages/shared-types | — | D · A |
| TR-32 | service_role solo en servidor; secretos fuera del repo | seguridad | lib/supabase/admin.ts (server-only) | — | — |
| TR-33 | Protección de datos de menores (minimización, logs sin PII, retención) | seguridad | bailarin.documento restringido | — | R · E |
| TR-34 | Rate limiting en endpoints públicos y de autenticación _(inferida)_ | seguridad | Supabase Auth rate limits + proxy | — | A · R · E |
| TR-35 | Headers de seguridad (CSP, HSTS, frame-ancestors) _(inferida)_ | seguridad | next.config headers | — | A · E |
| TR-36 | Roles extensibles mediante catálogo de permisos | identidad | rol · rol_permiso · fn private.tiene_permiso | — | R · I · E |
| TR-37 | client.config.ts validado con Zod en build | plataforma | clients/<slug>/client.config.ts | — | D |
| TR-38 | Theming por instancia con tokens CSS | plataforma | clients/<slug>/theme.css | — | E |
| TR-39 | Feature flags de módulos por cliente | plataforma | client.config.modulos | — | D |
| TR-40 | Plantilla clients/_template y comando /nuevo-cliente | plataforma | clients/_template | — | — |
| TR-41 | Migraciones por entorno con GitHub Actions; bloqueo de migraciones destructivas con evento en curso | plataforma | .github/workflows/migraciones.yml | — | — |
| TR-42 | CI con lint, typecheck, tests, i18n y RLS | plataforma | .github/workflows/ci.yml | — | — |
| TR-43 | Previews de Vercel contra staging | plataforma | Vercel | — | — |
| TR-44 | Emails transaccionales con Resend y dominio verificado | comunicados | packages/email-templates | — | I |
| TR-45 | Tareas largas (ZIP, envíos masivos) en colas pgmq y Edge Functions | plataforma | pgmq · supabase/functions | — | — |
| TR-46 | Propagación del orden en tiempo real en menos de 1 segundo a todos los roles | orden | Supabase Realtime | — | — |
| TR-47 | Modo offline (cobros en la mesa y jurado) con cola local idempotente | plataforma | IndexedDB outbox · client_uuid | — | D · A · R |
| TR-48 | Observabilidad: logs estructurados sin PII y errores _(inferida)_ | plataforma | lib/log.ts | — | — |
| TR-49 | Backups y restauración por instancia _(inferida)_ | plataforma | Supabase PITR (plan pago) | — | — |
| TR-50 | Playbook de alta de cliente en menos de un día | plataforma | docs/runbooks | — | — |
| TR-51 | PWA instalable con notificaciones push | plataforma | service worker | — | — |
| TR-52 | App nativa fuera de alcance hasta tener datos de uso de la PWA | plataforma | — | — | — |

## Funcionalidades sin prueba vinculada

- **SA-14** (Super Admin, etapa 1): Configurar marca, módulos e idiomas de la instancia (client.config)
- **OR-50** (Organizador, etapa 6): Enviar recordatorios automáticos (cierre de inscripción, música faltante)
- **PR-01** (Profesor/Academia, etapa 3): Registrarse e iniciar sesión (email y contraseña, Google o magic link)
- **PR-02** (Profesor/Academia, etapa 3): Elegir idioma y guardarlo en el perfil
- **PR-24** (Profesor/Academia, etapa 4): Recibir cambios del orden en tiempo real
- **PR-27** (Profesor/Academia, etapa 3): Reinscribir en la final la coreografía presentada en un selectivo
- **PR-33** (Profesor/Academia, etapa 6): Ver los comunicados del evento en su panel
- **JU-01** (Jurado, etapa 5): Acceder con magic link
- **JU-09** (Jurado, etapa 5): Usar la interfaz en su idioma
- **JU-10** (Jurado, etapa 5): Ver en tiempo real qué coreografía está en escena
- **OP-04** (Operativos, etapa 5): Director técnico: cerrar puntajes de un bloque y disparar el cálculo del ranking
- **OP-16** (Operativos, etapa 4): DJ: recibir el reorden en tiempo real
- **PU-11** (Sitio público, etapa 1): Textos legales por cliente (términos, privacidad)
- **TR-24** (Transversal, etapa 1): CI falla si falta una clave de traducción
- **TR-25** (Transversal, etapa 1): Agregar un idioma nuevo sin tocar pantallas (catálogo de idiomas configurable)
- **TR-26** (Transversal, etapa 6): Traducción asistida por IA con revisión humana (opcional)
- **TR-28** (Transversal, etapa 2): Pruebas de RLS por rol
- **TR-32** (Transversal, etapa 1): service_role solo en servidor; secretos fuera del repo
- **TR-40** (Transversal, etapa 9): Plantilla clients/_template y comando /nuevo-cliente
- **TR-41** (Transversal, etapa 1): Migraciones por entorno con GitHub Actions; bloqueo de migraciones destructivas con evento en curso
- **TR-42** (Transversal, etapa 1): CI con lint, typecheck, tests, i18n y RLS
- **TR-43** (Transversal, etapa 1): Previews de Vercel contra staging
- **TR-45** (Transversal, etapa 4): Tareas largas (ZIP, envíos masivos) en colas pgmq y Edge Functions
- **TR-46** (Transversal, etapa 4): Propagación del orden en tiempo real en menos de 1 segundo a todos los roles
- **TR-48** (Transversal, etapa 6): Observabilidad: logs estructurados sin PII y errores
- **TR-49** (Transversal, etapa 9): Backups y restauración por instancia
- **TR-50** (Transversal, etapa 9): Playbook de alta de cliente en menos de un día
- **TR-51** (Transversal, etapa 9): PWA instalable con notificaciones push
- **TR-52** (Transversal, etapa —): App nativa fuera de alcance hasta tener datos de uso de la PWA
