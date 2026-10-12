# Esquema de datos de SOED

> Generado por `node scripts/esquema-doc.mjs` desde `supabase/migrations/`. No editar a mano: cambiar la migración y regenerar.

Principios (ADR-0004, ADR-0007, CLAUDE.md): RLS en todas las tablas en la misma migración; aislamiento por `evento_id`; permisos por evento con `private.eventos_con_permiso()`; índice en toda clave foránea (verificado por pgTAP); montos en centavos; contenido del organizador en `jsonb` traducible; público solo por RPC `security definer` sin datos personales.

## Migraciones

- `20261002000100_base_identidad.sql`
- `20261002000200_temporadas_eventos.sql`
- `20261002000300_academias_inscripciones.sql`
- `20261002000400_liquidaciones_cobros.sql`
- `20261002000500_orden_salida.sql`
- `20261002000600_puntajes_resultados.sql`
- `20261002000700_acreditacion_comunicaciones.sql`
- `20261002000800_auditoria_storage_publico.sql`

## Tablas (50)

### `private.limite_frecuencia`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `clave` | text not null |
| `ventana` | timestamptz not null |
| `conteo` | integer not null default 0 |

**RLS:** habilitada sin políticas (solo funciones del esquema private).

### `public.academia`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `nombre` | text not null |
| `ciudad` | text |
| `region` | text |
| `pais` | text |
| `email` | text |
| `telefono` | text |
| `redes` | jsonb not null default '{}'::jsonb |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** academia_lectura (select, authenticated) · academia_alta (insert, authenticated) · academia_edicion (update, authenticated)

### `public.academia_invitacion`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `academia_id` | uuid not null → public.academia |
| `email` | text not null |
| `token` | text not null unique default replace(gen_random_uuid()::text, '-', '') |
| `invitado_por` | uuid → auth.users |
| `aceptada_at` | timestamptz |
| `vence_at` | timestamptz not null default now() + interval '14 days' |
| `creado_at` | timestamptz not null default now() |

**RLS:** academia_invitacion_gestion (all, authenticated)

### `public.academia_miembro`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `academia_id` | uuid not null → public.academia |
| `usuario_id` | uuid not null → auth.users |
| `rol` | text not null default 'PROFESOR' |
| `activo` | boolean not null default true |
| `creado_at` | timestamptz not null default now() |

**RLS:** academia_miembro_lectura (select, authenticated) · academia_miembro_gestion (all, authenticated)

### `public.acreditacion_registro`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `credencial_id` | uuid not null → public.credencial |
| `accion` | text not null |
| `zona` | text |
| `client_uuid` | uuid not null unique |
| `registrado_por` | uuid not null → auth.users |
| `registrado_at` | timestamptz not null default now() |
| `dispositivo_at` | timestamptz |

**RLS:** acreditacion_registro_lectura (select, authenticated) · acreditacion_registro_alta (insert, authenticated)

### `public.ajuste_liquidacion`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `inscripcion_id` | uuid not null |
| `tipo` | text not null |
| `monto_centavos` | bigint |
| `porcentaje` | numeric(5, 2) |
| `motivo` | text not null |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `anulado_at` | timestamptz |
| `references` | public.inscripcion (id, evento_id, academia_id) on delete cascade |
| `or` | (tipo in ('MONTO_LIBRE', 'DESCUENTO_MONTO') and monto_centavos is not null and porcentaje is null) |
| `or` | (tipo = 'DESCUENTO_PORCENTAJE' and porcentaje is not null and monto_centavos is null) |

**RLS:** ajuste_lectura (select, authenticated) · ajuste_gestion (insert, authenticated) · ajuste_anulacion (update, authenticated)

### `public.auditoria`

_20261002000800_auditoria_storage_publico.sql_

| Columna | Tipo |
| --- | --- |
| `id` | bigint generated always as identity primary key |
| `ocurrido_at` | timestamptz not null default now() |
| `usuario_id` | uuid |
| `rol_sesion` | text |
| `evento_id` | uuid |
| `tabla` | text not null |
| `registro_id` | text |
| `accion` | text not null |
| `antes` | jsonb |
| `despues` | jsonb |

**RLS:** auditoria_lectura (select, authenticated)

### `public.bailarin`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `academia_id` | uuid not null → public.academia |
| `nombre` | text not null |
| `apellido` | text not null |
| `fecha_nacimiento` | date not null |
| `documento_tipo` | text |
| `documento_numero` | text |
| `activo` | boolean not null default true |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** bailarin_lectura (select, authenticated) · bailarin_escritura (insert, authenticated) · bailarin_edicion (update, authenticated)

### `public.bloque`

_20261002000500_orden_salida.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `pista_id` | uuid not null |
| `nombre` | jsonb not null |
| `inicio_programado` | timestamptz |
| `orden` | smallint not null default 1 |

**RLS:** bloque_lectura (select, authenticated) · bloque_gestion (all, authenticated)

### `public.campo_adicional`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `entidad` | text not null |
| `codigo` | text not null |
| `etiqueta` | jsonb not null |
| `tipo` | text not null |
| `obligatorio` | boolean not null default false |
| `opciones` | jsonb not null default '[]'::jsonb |
| `orden` | smallint not null default 0 |

**RLS:** campo_adicional_lectura (select, authenticated) · campo_adicional_gestion (all, authenticated)

### `public.clase`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `nombre` | jsonb not null |
| `docente` | text |
| `sala` | text |
| `inicio` | timestamptz not null |
| `fin` | timestamptz not null |
| `cupo` | integer not null |
| `precio_centavos` | bigint not null default 0 |
| `publicada` | boolean not null default false |

**RLS:** clase_lectura (select, authenticated) · clase_gestion (all, authenticated)

### `public.cobro`

_20261002000400_liquidaciones_cobros.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `liquidacion_id` | uuid not null |
| `monto_centavos` | bigint not null |
| `moneda` | text not null → public.moneda |
| `medio` | text not null |
| `referencia` | text |
| `nota` | text |
| `client_uuid` | uuid not null unique |
| `turno_caja_id` | uuid → public.turno_caja |
| `registrado_por` | uuid not null → auth.users |
| `registrado_at` | timestamptz not null default now() |
| `dispositivo_at` | timestamptz |
| `anulado_at` | timestamptz |
| `anulado_por` | uuid → auth.users |
| `motivo_anulacion` | text |
| `references` | public.liquidacion (id, evento_id, academia_id) on delete restrict |
| `or` | (anulado_at is not null and motivo_anulacion is not null) |

**RLS:** cobro_lectura (select, authenticated) · cobro_alta (insert, authenticated) · cobro_anulacion (update, authenticated)

### `public.comunicado`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `asunto` | jsonb not null |
| `cuerpo` | jsonb not null |
| `audiencia` | text[] not null |
| `estado` | text not null default 'BORRADOR' |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `enviado_at` | timestamptz |

**RLS:** comunicado_lectura (select, authenticated) · comunicado_gestion (all, authenticated)

### `public.coreografia`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `academia_id` | uuid not null → public.academia |
| `nombre` | text not null |
| `genero` | text not null |
| `formacion` | text not null |
| `coreografo` | text |
| `musica_path` | text |
| `musica_nombre` | text |
| `musica_duracion_seg` | integer |
| `musica_subida_at` | timestamptz |
| `activa` | boolean not null default true |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** coreografia_lectura (select, authenticated) · coreografia_escritura (insert, authenticated) · coreografia_edicion (update, authenticated)

### `public.coreografia_bailarin`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `coreografia_id` | uuid not null |
| `bailarin_id` | uuid not null |
| `academia_id` | uuid not null |
| `es_coreografo` | boolean not null default false |

**RLS:** coreografia_bailarin_lectura (select, authenticated) · coreografia_bailarin_escritura (all, authenticated)

### `public.credencial`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `tipo` | text not null |
| `academia_id` | uuid → public.academia |
| `bailarin_id` | uuid |
| `usuario_id` | uuid → auth.users |
| `nombre_mostrado` | text not null |
| `zonas` | text[] not null default '{}' |
| `qr_token` | text not null unique default replace(gen_random_uuid()::text, '-', '') |
| `acreditado_at` | timestamptz |
| `acreditado_por` | uuid → auth.users |
| `anulada` | boolean not null default false |
| `creado_at` | timestamptz not null default now() |

**RLS:** credencial_lectura (select, authenticated) · credencial_gestion (all, authenticated)

### `public.criterio`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `codigo` | text not null |
| `nombre` | jsonb not null |
| `peso` | numeric(6, 3) not null default 1 |
| `orden` | smallint not null default 1 |

**RLS:** criterio_lectura (select, authenticated) · criterio_gestion (all, authenticated)

### `public.email_envio`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid → public.evento |
| `usuario_id` | uuid → auth.users |
| `destinatario` | text not null |
| `plantilla` | text not null |
| `idioma` | text not null → public.idioma |
| `payload` | jsonb not null default '{}'::jsonb |
| `estado` | text not null default 'PENDIENTE' |
| `proveedor_id` | text |
| `error` | text |
| `intentos` | smallint not null default 0 |
| `creado_at` | timestamptz not null default now() |
| `enviado_at` | timestamptz |

**RLS:** email_envio_lectura (select, authenticated)

### `public.entrada_tipo`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `nombre` | jsonb not null |
| `fecha` | date |
| `cupo` | integer not null |
| `precio_centavos` | bigint not null |
| `publicada` | boolean not null default false |

**RLS:** entrada_tipo_lectura (select, authenticated) · entrada_tipo_gestion (all, authenticated)

### `public.evento`

_20261002000200_temporadas_eventos.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `temporada_id` | uuid not null → public.temporada |
| `slug` | text not null unique |
| `tipo` | text not null |
| `estado` | text not null default 'BORRADOR' |
| `nombre` | jsonb not null |
| `idioma_defecto` | text not null default 'es' → public.idioma |
| `moneda` | text not null → public.moneda |
| `zona_horaria` | text not null default 'America/Sao_Paulo' |
| `sede` | jsonb not null default '{}'::jsonb |
| `fecha_inicio` | date not null |
| `fecha_fin` | date not null |
| `inscripcion_apertura` | timestamptz |
| `inscripcion_cierre` | timestamptz |
| `modificaciones_cierre` | timestamptz |
| `cupo_fichas` | integer |
| `reglamento` | jsonb not null |
| `reglamento_version` | integer not null default 1 |
| `tarifario` | jsonb not null default '{}'::jsonb |
| `medios_cobro` | text[] not null default array['EFECTIVO', 'MERCADO_PAGO', 'TRANSFERENCIA', 'PIX', 'OTRO'] |
| `datos_pago` | jsonb not null default '{}'::jsonb |
| `campos_adicionales` | jsonb not null default '{}'::jsonb |
| `bases` | jsonb not null default '{}'::jsonb |
| `acreditacion` | jsonb not null default '{}'::jsonb |
| `config_operacion` | jsonb not null default '{}'::jsonb |
| `publicado` | boolean not null default false |
| `orden_publicado_at` | timestamptz |
| `resultados_publicados_at` | timestamptz |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |
| `and` | (modificaciones_cierre is null or inscripcion_cierre is null or modificaciones_cierre >= inscripcion_cierre) |

**RLS:** evento_lectura (select, authenticated) · evento_publico (select, anon) · evento_alta (insert, authenticated) · evento_edicion (update, authenticated) · evento_baja (delete, authenticated)

### `public.evento_contador`

_20261002000200_temporadas_eventos.sql_

| Columna | Tipo |
| --- | --- |
| `evento_id` | uuid not null → public.evento |
| `tipo` | text not null |
| `ultimo` | integer not null default 0 |

**RLS:** habilitada; acceso por funciones o vistas.

### `public.evento_miembro`

_20261002000200_temporadas_eventos.sql_

| Columna | Tipo |
| --- | --- |
| `evento_id` | uuid not null → public.evento |
| `usuario_id` | uuid not null → auth.users |
| `rol` | text not null → public.rol |
| `activo` | boolean not null default true |
| `asignado_por` | uuid → auth.users |
| `asignado_at` | timestamptz not null default now() |

**RLS:** evento_miembro_lectura (select, authenticated) · evento_miembro_alta (insert, authenticated) · evento_miembro_edicion (update, authenticated) · evento_miembro_baja (delete, authenticated)

### `public.ficha`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `inscripcion_id` | uuid not null |
| `coreografia_id` | uuid not null |
| `nombre` | text not null |
| `genero` | text not null |
| `formacion` | text not null |
| `categoria_declarada` | text |
| `categoria` | text |
| `estado` | text not null default 'BORRADOR' |
| `observacion` | text |
| `bloqueada` | boolean not null default false |
| `excepcion` | jsonb |
| `validacion` | jsonb |
| `validacion_reglamento_version` | integer |
| `musica_path` | text |
| `musica_duracion_seg` | integer |
| `datos_adicionales` | jsonb not null default '{}'::jsonb |
| `enviada_at` | timestamptz |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |
| `references` | public.inscripcion (id, evento_id, academia_id) on delete restrict |
| `estado` | not in ('ENVIADA', 'APROBADA') |
| `or` | excepcion is not null |
| `or` | coalesce((validacion ->> 'valida')::boolean, false) |

**RLS:** ficha_lectura (select, authenticated) · ficha_alta (insert, authenticated) · ficha_edicion (update, authenticated)

### `public.ficha_bailarin`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `ficha_id` | uuid not null |
| `bailarin_id` | uuid not null |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `nombre_mostrado` | text not null |
| `edad` | integer |
| `categoria` | text |
| `es_coreografo` | boolean not null default false |

**RLS:** ficha_bailarin_lectura (select, authenticated) · ficha_bailarin_escritura (all, authenticated)

### `public.hotel`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `nombre` | text not null |
| `descripcion` | jsonb not null default '{}'::jsonb |
| `cupo` | integer not null |
| `precio_centavos` | bigint |
| `criterio_asignacion` | text not null default 'PRIMER_PAGO' |

**RLS:** hotel_lectura (select, authenticated) · hotel_gestion (all, authenticated)

### `public.hotel_solicitud`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `hotel_id` | uuid not null |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `inscripcion_id` | uuid not null |
| `plazas` | integer not null |
| `creado_at` | timestamptz not null default now() |

**RLS:** hotel_solicitud_lectura (select, authenticated) · hotel_solicitud_gestion (all, authenticated)

### `public.idioma`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `codigo` | text primary key |
| `nombre` | text not null |
| `activo` | boolean not null default true |

**RLS:** idioma_lectura (select, anon)

### `public.inscripcion`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `academia_id` | uuid not null → public.academia |
| `estado` | text not null default 'ACTIVA' |
| `rubros` | jsonb not null default '[]'::jsonb |
| `datos_adicionales` | jsonb not null default '{}'::jsonb |
| `inscripta_at` | timestamptz not null default now() |
| `creado_por` | uuid → auth.users |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** inscripcion_lectura (select, authenticated) · inscripcion_alta (insert, authenticated) · inscripcion_edicion (update, authenticated)

### `public.liquidacion`

_20261002000400_liquidaciones_cobros.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `inscripcion_id` | uuid not null unique |
| `correlativo` | integer not null |
| `numero` | text not null unique |
| `creado_at` | timestamptz not null default now() |
| `references` | public.inscripcion (id, evento_id, academia_id) on delete restrict |

**RLS:** liquidacion_lectura (select, authenticated)

### `public.liquidacion_version`

_20261002000400_liquidaciones_cobros.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `liquidacion_id` | uuid not null |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `version` | integer not null |
| `total_centavos` | bigint not null |
| `moneda` | text not null → public.moneda |
| `detalle` | jsonb not null |
| `idioma` | text not null default 'es' → public.idioma |
| `qr_token` | text not null unique default replace(gen_random_uuid()::text, '-', '') |
| `pdf_path` | text |
| `emitida_por` | uuid → auth.users |
| `emitida_at` | timestamptz not null default now() |
| `references` | public.liquidacion (id, evento_id, academia_id) on delete restrict |

**RLS:** liquidacion_version_lectura (select, authenticated)

### `public.moneda`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `codigo` | text primary key |
| `decimales` | smallint not null default 2 |
| `activo` | boolean not null default true |

**RLS:** moneda_lectura (select, anon)

### `public.orden_item`

_20261002000500_orden_salida.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `pista_id` | uuid not null |
| `bloque_id` | uuid not null |
| `ficha_id` | uuid not null |
| `posicion` | integer not null |
| `estado` | text not null default 'PROGRAMADA' |
| `actualizado_por` | uuid → auth.users |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** orden_item_lectura (select, authenticated) · orden_item_alta (insert, authenticated) · orden_item_estado (update, authenticated) · orden_item_baja (delete, authenticated)

### `public.pase`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_origen_id` | uuid → public.evento |
| `evento_destino_id` | uuid not null → public.evento |
| `academia_id` | uuid not null → public.academia |
| `coreografia_id` | uuid |
| `motivo` | text not null |
| `beneficio` | jsonb |
| `registrado_por` | uuid not null → auth.users |
| `registrado_at` | timestamptz not null default now() |
| `anulado_at` | timestamptz |
| `anulado_por` | uuid → auth.users |
| `motivo_anulacion` | text |

**RLS:** pase_lectura (select, authenticated) · pase_alta (insert, authenticated) · pase_anulacion (update, authenticated)

### `public.perfil`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key → auth.users |
| `nombre` | text not null default '' |
| `email` | text |
| `telefono` | text |
| `idioma` | text not null default 'es' → public.idioma |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** perfil_propio_lectura (select, authenticated) · perfil_propio_edicion (update, authenticated) · perfil_equipo_lectura (select, authenticated) · perfil_academia_lectura (select, authenticated)

### `public.permiso`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `codigo` | text primary key |
| `descripcion` | text not null |

**RLS:** permiso_lectura (select, authenticated) · permiso_admin (all, authenticated)

### `public.pista`

_20261002000500_orden_salida.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `nombre` | jsonb not null |
| `orden` | smallint not null default 1 |

**RLS:** pista_lectura (select, authenticated) · pista_gestion (all, authenticated)

### `public.planilla`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `ficha_id` | uuid not null |
| `jurado_id` | uuid not null → auth.users |
| `estado` | text not null default 'BORRADOR' |
| `comentario` | text |
| `total` | numeric(8, 4) |
| `client_uuid` | uuid unique |
| `enviada_at` | timestamptz |
| `reabierta_por` | uuid → auth.users |
| `motivo_reapertura` | text |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** planilla_lectura (select, authenticated) · planilla_alta (insert, authenticated) · planilla_edicion (update, authenticated)

### `public.planilla_nota`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `planilla_id` | uuid not null |
| `criterio_id` | uuid not null |
| `evento_id` | uuid not null |
| `valor` | numeric(6, 3) not null |

**RLS:** planilla_nota_lectura (select, authenticated) · planilla_nota_escritura (all, authenticated)

### `public.premio`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `temporada_id` | uuid not null → public.temporada |
| `evento_id` | uuid → public.evento |
| `nombre` | jsonb not null |
| `tipo` | text not null |
| `monto_centavos` | bigint |
| `moneda` | text → public.moneda |
| `criterio` | text not null default 'MANUAL' |
| `regla_empate` | text not null default 'DIVIDIR_MONTO' |
| `filtro` | jsonb not null default '{}'::jsonb |
| `orden` | smallint not null default 1 |

**RLS:** premio_lectura (select, authenticated) · premio_admin (all, authenticated)

### `public.premio_asignacion`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `premio_id` | uuid not null → public.premio |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `ficha_id` | uuid not null |
| `monto_centavos` | bigint |
| `nota` | text |
| `asignado_por` | uuid → auth.users |
| `asignado_at` | timestamptz not null default now() |

**RLS:** premio_asignacion_lectura (select, authenticated) · premio_asignacion_gestion (all, authenticated)

### `public.reglamento`

_20261002000200_temporadas_eventos.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `nombre` | jsonb not null |
| `preset` | text |
| `version` | integer not null default 1 |
| `config` | jsonb not null |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** reglamento_lectura (select, authenticated) · reglamento_admin (all, authenticated)

### `public.reserva_clase`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `clase_id` | uuid not null |
| `evento_id` | uuid not null |
| `academia_id` | uuid → public.academia |
| `nombre` | text not null |
| `email` | text |
| `estado` | text not null default 'RESERVADA' |
| `pagada` | boolean not null default false |
| `cobrado_por` | uuid → auth.users |
| `cobrado_at` | timestamptz |
| `creado_at` | timestamptz not null default now() |

**RLS:** reserva_clase_lectura (select, authenticated) · reserva_clase_academia (insert, authenticated) · reserva_clase_gestion (update, authenticated)

### `public.reserva_entrada`

_20261002000700_acreditacion_comunicaciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `entrada_tipo_id` | uuid not null |
| `evento_id` | uuid not null |
| `nombre` | text not null |
| `email` | text not null |
| `cantidad` | integer not null |
| `estado` | text not null default 'RESERVADA' |
| `pagada` | boolean not null default false |
| `codigo` | text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)) |
| `cobrado_por` | uuid → auth.users |
| `cobrado_at` | timestamptz |
| `creado_at` | timestamptz not null default now() |

**RLS:** reserva_entrada_gestion (select, authenticated) · reserva_entrada_cobro (update, authenticated)

### `public.resultado`

_20261002000600_puntajes_resultados.sql_

| Columna | Tipo |
| --- | --- |
| `ficha_id` | uuid primary key |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `puntaje` | numeric(8, 4) not null |
| `banda` | text |
| `grupo` | text not null |
| `puesto` | integer not null |
| `calculado_at` | timestamptz not null default now() |
| `calculado_por` | uuid → auth.users |

**RLS:** resultado_lectura (select, authenticated)

### `public.rol`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `codigo` | text primary key |
| `nombre` | jsonb not null |
| `sistema` | boolean not null default false |
| `orden` | smallint not null default 100 |

**RLS:** rol_lectura (select, authenticated) · rol_admin (all, authenticated)

### `public.rol_global`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `usuario_id` | uuid not null → auth.users |
| `rol` | text not null |
| `otorgado_at` | timestamptz not null default now() |
| `otorgado_por` | uuid → auth.users |

**RLS:** rol_global_lectura (select, authenticated)

### `public.rol_permiso`

_20261002000100_base_identidad.sql_

| Columna | Tipo |
| --- | --- |
| `rol` | text not null → public.rol |
| `permiso` | text not null → public.permiso |

**RLS:** rol_permiso_lectura (select, authenticated) · rol_permiso_admin (all, authenticated)

### `public.solicitud_modificacion`

_20261002000300_academias_inscripciones.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null |
| `academia_id` | uuid not null |
| `ficha_id` | uuid not null |
| `descripcion` | text not null |
| `estado` | text not null default 'PENDIENTE' |
| `respuesta` | text |
| `creado_por` | uuid → auth.users |
| `creado_at` | timestamptz not null default now() |
| `resuelto_por` | uuid → auth.users |
| `resuelto_at` | timestamptz |

**RLS:** solicitud_lectura (select, authenticated) · solicitud_alta (insert, authenticated) · solicitud_resolucion (update, authenticated)

### `public.temporada`

_20261002000200_temporadas_eventos.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `anio` | integer not null |
| `nombre` | jsonb not null |
| `reglamento_id` | uuid → public.reglamento |
| `publicada` | boolean not null default false |
| `creado_at` | timestamptz not null default now() |
| `actualizado_at` | timestamptz not null default now() |

**RLS:** temporada_lectura (select, authenticated) · temporada_publica (select, anon) · temporada_admin (all, authenticated)

### `public.turno_caja`

_20261002000400_liquidaciones_cobros.sql_

| Columna | Tipo |
| --- | --- |
| `id` | uuid primary key default gen_random_uuid() |
| `evento_id` | uuid not null → public.evento |
| `usuario_id` | uuid not null → auth.users |
| `abierto_at` | timestamptz not null default now() |
| `cerrado_at` | timestamptz |
| `cerrado_por` | uuid → auth.users |
| `resumen` | jsonb |

**RLS:** turno_caja_lectura (select, authenticated) · turno_caja_apertura (insert, authenticated) · turno_caja_cierre (update, authenticated)

## Funciones públicas (RPC)

| Función | Argumentos | Migración |
| --- | --- | --- |
| `ver_invitacion` | `p_token text` | 20261002000300_academias_inscripciones.sql |
| `aceptar_invitacion` | `p_token text` | 20261002000300_academias_inscripciones.sql |
| `crear_liquidacion` | `p_inscripcion uuid` | 20261002000400_liquidaciones_cobros.sql |
| `reordenar_orden` | `p_item uuid, p_bloque_destino uuid, p_posicion integer` | 20261002000500_orden_salida.sql |
| `eventos_destino_pase` | `p_origen uuid` | 20261002000600_puntajes_resultados.sql |
| `reservar_entrada` | `p_entrada_tipo_id uuid, p_nombre text, p_email text, p_cantidad integer, p_origen text` | 20261002000700_acreditacion_comunicaciones.sql |
| `reservar_clase` | `p_clase_id uuid, p_nombre text, p_email text, p_origen text` | 20261002000700_acreditacion_comunicaciones.sql |
| `publico_orden` | `p_slug text` | 20261002000800_auditoria_storage_publico.sql |
| `publico_resultados` | `p_slug text` | 20261002000800_auditoria_storage_publico.sql |
| `publico_cronograma` | `p_slug text` | 20261002000800_auditoria_storage_publico.sql |
| `publico_clases` | `p_slug text` | 20261002000800_auditoria_storage_publico.sql |
| `publico_entradas` | `p_slug text` | 20261002000800_auditoria_storage_publico.sql |

## Funciones auxiliares (`private`)

| Función | Argumentos |
| --- | --- |
| `set_actualizado_at` | `—` |
| `es_usuario_final` | `—` |
| `es_traducible` | `valor jsonb` |
| `crear_perfil` | `—` |
| `es_super_admin` | `—` |
| `reglamento_estructura_valida` | `c jsonb` |
| `reglamento_codigos` | `c jsonb, lista text` |
| `eventos_con_permiso` | `p_permiso text` |
| `eventos_miembro` | `—` |
| `tiene_permiso` | `p_evento uuid, p_permiso text` |
| `eventos_resultados_publicados` | `—` |
| `eventos_orden_publicado` | `—` |
| `siguiente_numero` | `p_evento uuid, p_tipo text` |
| `guardar_evento` | `—` |
| `academias_del_usuario` | `—` |
| `academias_titular` | `—` |
| `alta_titular_academia` | `—` |
| `academias_en_eventos_con_permiso` | `p_permiso text` |
| `ventana_evento` | `p_evento uuid` |
| `guardar_ficha` | `—` |
| `guardar_ficha_bailarin` | `—` |
| `guardar_inscripcion` | `—` |
| `guardar_cobro` | `—` |
| `liquidacion_version_inmutable` | `—` |
| `tocar_orden_item` | `—` |
| `guardar_planilla` | `—` |
| `guardar_planilla_nota` | `—` |
| `recalcular_total_planilla` | `—` |
| `guardar_pase` | `—` |
| `aplicar_acreditacion` | `—` |
| `verificar_cupo_clase` | `—` |
| `verificar_cupo_entrada` | `—` |
| `consumir_limite` | `p_clave text, p_maximo integer, p_ventana interval` |
| `columnas_excluidas_auditoria` | `—` |
| `auditar` | `—` |
| `uuid_seguro` | `valor text` |
| `coreografias_musica_descargable` | `—` |

## Políticas de Storage

- musica_lectura (select, authenticated)
- musica_subida (insert, authenticated)
- musica_reemplazo (update, authenticated)
- musica_borrado (delete, authenticated)
- documentos_lectura (select, authenticated)
- publico_escritura (insert, authenticated)
