-- =============================================================================
-- SOED · 0300 · Academias, bailarines, coreografías, inscripciones y fichas
-- Datos compartidos en la organización (academia, bailarín, coreografía) y
-- propios del evento (inscripción, ficha, elenco de la ficha). ADR-0004.
--
-- Columnas derivadas (categoria, validacion) las escribe solo el servidor con
-- service_role después de ejecutar el dominio; los triggers lo garantizan.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Academia y miembros
-- -----------------------------------------------------------------------------
create table public.academia (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 2 and 200),
  ciudad text check (char_length(ciudad) <= 120),
  region text check (char_length(region) <= 120),
  pais text check (char_length(pais) <= 80),
  email text check (char_length(email) <= 320),
  telefono text check (char_length(telefono) <= 40),
  redes jsonb not null default '{}'::jsonb check (jsonb_typeof(redes) = 'object'),
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index academia_creado_por_idx on public.academia (creado_por);
create index academia_nombre_trgm_idx on public.academia using gin (nombre extensions.gin_trgm_ops);
alter table public.academia enable row level security;
create trigger academia_actualizado_at before update on public.academia
  for each row execute function private.set_actualizado_at();

create table public.academia_miembro (
  academia_id uuid not null references public.academia (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol text not null default 'PROFESOR' check (rol in ('TITULAR', 'PROFESOR')),
  activo boolean not null default true,
  creado_at timestamptz not null default now(),
  primary key (academia_id, usuario_id)
);
create index academia_miembro_usuario_idx on public.academia_miembro (usuario_id) where activo;
alter table public.academia_miembro enable row level security;

create table public.academia_invitacion (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academia (id) on delete cascade,
  email text not null check (char_length(email) <= 320),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  invitado_por uuid references auth.users (id) on delete set null,
  aceptada_at timestamptz,
  vence_at timestamptz not null default now() + interval '14 days',
  creado_at timestamptz not null default now()
);
create index academia_invitacion_academia_idx on public.academia_invitacion (academia_id);
create index academia_invitacion_invitado_por_idx on public.academia_invitacion (invitado_por);
alter table public.academia_invitacion enable row level security;

create or replace function private.academias_del_usuario()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia_id from public.academia_miembro
   where usuario_id = (select auth.uid()) and activo
$$;

create or replace function private.academias_titular()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select academia_id from public.academia_miembro
   where usuario_id = (select auth.uid()) and activo and rol = 'TITULAR'
$$;

-- Quien crea una academia queda como titular.
create or replace function private.alta_titular_academia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    insert into public.academia_miembro (academia_id, usuario_id, rol)
    values (new.id, (select auth.uid()), 'TITULAR')
    on conflict do nothing;
  end if;
  return new;
end;
$$;
create trigger academia_alta_titular after insert on public.academia
  for each row execute function private.alta_titular_academia();

-- -----------------------------------------------------------------------------
-- Bailarín (datos personales de menores: acceso mínimo, TR-33)
-- -----------------------------------------------------------------------------
create table public.bailarin (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academia (id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 120),
  apellido text not null check (char_length(btrim(apellido)) between 1 and 120),
  fecha_nacimiento date not null check (fecha_nacimiento between date '1900-01-01' and date '2100-01-01'),
  documento_tipo text check (char_length(documento_tipo) <= 20),
  documento_numero text check (char_length(documento_numero) <= 40),
  activo boolean not null default true,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  unique (id, academia_id)
);
create index bailarin_academia_idx on public.bailarin (academia_id);
create unique index bailarin_documento_unq on public.bailarin (academia_id, documento_tipo, documento_numero)
  where documento_numero is not null;
create index bailarin_nombre_trgm_idx on public.bailarin
  using gin ((nombre || ' ' || apellido) extensions.gin_trgm_ops);
alter table public.bailarin enable row level security;
create trigger bailarin_actualizado_at before update on public.bailarin
  for each row execute function private.set_actualizado_at();

-- -----------------------------------------------------------------------------
-- Coreografía reutilizable y su elenco
-- -----------------------------------------------------------------------------
create table public.coreografia (
  id uuid primary key default gen_random_uuid(),
  academia_id uuid not null references public.academia (id) on delete restrict,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 200),
  genero text not null check (genero ~ '^[A-Z0-9_]+$'),
  formacion text not null check (formacion ~ '^[A-Z0-9_]+$'),
  coreografo text check (char_length(coreografo) <= 200),
  musica_path text,
  musica_nombre text check (char_length(musica_nombre) <= 255),
  musica_duracion_seg integer check (musica_duracion_seg between 1 and 3600),
  musica_subida_at timestamptz,
  activa boolean not null default true,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  unique (id, academia_id)
);
create index coreografia_academia_idx on public.coreografia (academia_id);
alter table public.coreografia enable row level security;
create trigger coreografia_actualizado_at before update on public.coreografia
  for each row execute function private.set_actualizado_at();

create table public.coreografia_bailarin (
  coreografia_id uuid not null,
  bailarin_id uuid not null,
  academia_id uuid not null,
  es_coreografo boolean not null default false,
  primary key (coreografia_id, bailarin_id),
  foreign key (coreografia_id, academia_id) references public.coreografia (id, academia_id) on delete cascade,
  foreign key (bailarin_id, academia_id) references public.bailarin (id, academia_id) on delete restrict
);
create index coreografia_bailarin_bailarin_idx on public.coreografia_bailarin (bailarin_id, academia_id);
create index coreografia_bailarin_academia_idx on public.coreografia_bailarin (coreografia_id, academia_id);
alter table public.coreografia_bailarin enable row level security;

-- -----------------------------------------------------------------------------
-- Inscripción de la academia al evento
-- -----------------------------------------------------------------------------
create table public.inscripcion (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete restrict,
  academia_id uuid not null references public.academia (id) on delete restrict,
  estado text not null default 'ACTIVA' check (estado in ('ACTIVA', 'RETIRADA')),
  rubros jsonb not null default '[]'::jsonb check (jsonb_typeof(rubros) = 'array'),
  datos_adicionales jsonb not null default '{}'::jsonb check (jsonb_typeof(datos_adicionales) = 'object'),
  inscripta_at timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  actualizado_at timestamptz not null default now(),
  unique (evento_id, academia_id),
  unique (id, evento_id, academia_id)
);
create index inscripcion_academia_idx on public.inscripcion (academia_id);
create index inscripcion_creado_por_idx on public.inscripcion (creado_por);
alter table public.inscripcion enable row level security;
create trigger inscripcion_actualizado_at before update on public.inscripcion
  for each row execute function private.set_actualizado_at();

-- Academias inscriptas en eventos donde el usuario tiene el permiso.
create or replace function private.academias_en_eventos_con_permiso(p_permiso text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.academia_id from public.inscripcion i
   where i.evento_id in (select private.eventos_con_permiso(p_permiso))
$$;

-- Ajustes de liquidación del organizador (OR-25): sin cargo, monto libre, descuentos.
create table public.ajuste_liquidacion (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  inscripcion_id uuid not null,
  tipo text not null check (tipo in ('SIN_CARGO', 'MONTO_LIBRE', 'DESCUENTO_PORCENTAJE', 'DESCUENTO_MONTO')),
  monto_centavos bigint check (monto_centavos >= 0),
  porcentaje numeric(5, 2) check (porcentaje > 0 and porcentaje <= 100),
  motivo text not null check (char_length(btrim(motivo)) >= 3),
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  anulado_at timestamptz,
  foreign key (inscripcion_id, evento_id, academia_id)
    references public.inscripcion (id, evento_id, academia_id) on delete cascade,
  constraint ajuste_valores check (
    (tipo = 'SIN_CARGO' and monto_centavos is null and porcentaje is null)
    or (tipo in ('MONTO_LIBRE', 'DESCUENTO_MONTO') and monto_centavos is not null and porcentaje is null)
    or (tipo = 'DESCUENTO_PORCENTAJE' and porcentaje is not null and monto_centavos is null)
  )
);
create index ajuste_liquidacion_inscripcion_idx on public.ajuste_liquidacion (inscripcion_id, evento_id, academia_id);
create index ajuste_liquidacion_evento_idx on public.ajuste_liquidacion (evento_id);
create index ajuste_liquidacion_creado_por_idx on public.ajuste_liquidacion (creado_por);
alter table public.ajuste_liquidacion enable row level security;

-- -----------------------------------------------------------------------------
-- Ficha: coreografía inscripta a un evento (snapshot de elenco y música)
-- -----------------------------------------------------------------------------
create table public.ficha (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  inscripcion_id uuid not null,
  coreografia_id uuid not null,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 200),
  genero text not null,
  formacion text not null,
  categoria_declarada text,
  categoria text,
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR', 'ENVIADA', 'OBSERVADA', 'APROBADA', 'RETIRADA')),
  observacion text check (char_length(observacion) <= 2000),
  bloqueada boolean not null default false,
  excepcion jsonb check (excepcion is null or (jsonb_typeof(excepcion) = 'object' and excepcion ? 'motivo')),
  validacion jsonb check (validacion is null or (jsonb_typeof(validacion) = 'object' and validacion ? 'valida')),
  validacion_reglamento_version integer,
  musica_path text,
  musica_duracion_seg integer check (musica_duracion_seg between 1 and 3600),
  datos_adicionales jsonb not null default '{}'::jsonb check (jsonb_typeof(datos_adicionales) = 'object'),
  enviada_at timestamptz,
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  unique (evento_id, coreografia_id),
  unique (id, evento_id, academia_id),
  foreign key (inscripcion_id, evento_id, academia_id)
    references public.inscripcion (id, evento_id, academia_id) on delete restrict,
  foreign key (coreografia_id, academia_id) references public.coreografia (id, academia_id) on delete restrict,
  -- Una ficha enviada o aprobada tiene validación aprobada o excepción registrada.
  constraint ficha_envio_valido check (
    estado not in ('ENVIADA', 'APROBADA')
    or excepcion is not null
    or coalesce((validacion ->> 'valida')::boolean, false)
  )
);
create index ficha_evento_estado_idx on public.ficha (evento_id, estado);
create index ficha_academia_idx on public.ficha (academia_id);
create index ficha_inscripcion_idx on public.ficha (inscripcion_id, evento_id, academia_id);
create index ficha_coreografia_idx on public.ficha (coreografia_id, academia_id);
create index ficha_creado_por_idx on public.ficha (creado_por);
alter table public.ficha enable row level security;
create trigger ficha_actualizado_at before update on public.ficha
  for each row execute function private.set_actualizado_at();

create table public.ficha_bailarin (
  ficha_id uuid not null,
  bailarin_id uuid not null,
  evento_id uuid not null,
  academia_id uuid not null,
  nombre_mostrado text not null check (char_length(nombre_mostrado) <= 250),
  edad integer check (edad between 0 and 130),
  categoria text,
  es_coreografo boolean not null default false,
  primary key (ficha_id, bailarin_id),
  foreign key (ficha_id, evento_id, academia_id) references public.ficha (id, evento_id, academia_id) on delete cascade,
  foreign key (bailarin_id, academia_id) references public.bailarin (id, academia_id) on delete restrict
);
create index ficha_bailarin_bailarin_idx on public.ficha_bailarin (bailarin_id, academia_id);
create index ficha_bailarin_evento_idx on public.ficha_bailarin (evento_id);
create index ficha_bailarin_ficha_idx on public.ficha_bailarin (ficha_id, evento_id, academia_id);
alter table public.ficha_bailarin enable row level security;

-- Campos adicionales configurables por evento (OR-16)
create table public.campo_adicional (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  entidad text not null check (entidad in ('INSCRIPCION', 'FICHA', 'BAILARIN')),
  codigo text not null check (codigo ~ '^[a-z0-9_]{1,40}$'),
  etiqueta jsonb not null check (private.es_traducible(etiqueta)),
  tipo text not null check (tipo in ('TEXTO', 'NUMERO', 'BOOLEANO', 'FECHA', 'OPCION')),
  obligatorio boolean not null default false,
  opciones jsonb not null default '[]'::jsonb check (jsonb_typeof(opciones) = 'array'),
  orden smallint not null default 0,
  unique (evento_id, entidad, codigo)
);
alter table public.campo_adicional enable row level security;

-- Solicitudes de modificación después del cierre (PR-20, OR-24)
create table public.solicitud_modificacion (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  ficha_id uuid not null,
  descripcion text not null check (char_length(btrim(descripcion)) between 5 and 4000),
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  respuesta text check (char_length(respuesta) <= 4000),
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  resuelto_por uuid references auth.users (id) on delete set null,
  resuelto_at timestamptz,
  foreign key (ficha_id, evento_id, academia_id) references public.ficha (id, evento_id, academia_id) on delete cascade
);
create index solicitud_modificacion_ficha_idx on public.solicitud_modificacion (ficha_id, evento_id, academia_id);
create index solicitud_modificacion_evento_idx on public.solicitud_modificacion (evento_id, estado);
create index solicitud_modificacion_academia_idx on public.solicitud_modificacion (academia_id);
create index solicitud_modificacion_creado_por_idx on public.solicitud_modificacion (creado_por);
create index solicitud_modificacion_resuelto_por_idx on public.solicitud_modificacion (resuelto_por);
alter table public.solicitud_modificacion enable row level security;

-- -----------------------------------------------------------------------------
-- Guardas de inscripción y ficha
-- -----------------------------------------------------------------------------
-- Estado de la ventana de inscripción del evento (equivalente SQL de estadoVentana).
create or replace function private.ventana_evento(p_evento uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when e.inscripcion_apertura is null or now() < e.inscripcion_apertura then 'NO_ABIERTA'
    when e.inscripcion_cierre is null or now() < e.inscripcion_cierre then 'ABIERTA'
    when now() < coalesce(e.modificaciones_cierre, e.inscripcion_cierre) then 'SOLO_MODIFICACIONES'
    else 'CERRADA'
  end
  from public.evento e where e.id = p_evento
$$;
grant execute on function private.ventana_evento(uuid) to authenticated, service_role;

create or replace function private.guardar_ficha()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gestor boolean;
  v_ventana text;
  v_reglamento jsonb;
begin
  -- Integridad de códigos contra el reglamento del evento (para todos los roles).
  select reglamento into v_reglamento from public.evento where id = new.evento_id;
  if not (new.genero = any (private.reglamento_codigos(v_reglamento, 'generos'))) then
    raise exception 'GENERO_DESCONOCIDO' using errcode = 'P0001';
  end if;
  if not (new.formacion = any (private.reglamento_codigos(v_reglamento, 'formaciones'))) then
    raise exception 'FORMACION_DESCONOCIDA' using errcode = 'P0001';
  end if;
  if new.categoria_declarada is not null
     and not (new.categoria_declarada = any (private.reglamento_codigos(v_reglamento, 'categorias'))) then
    raise exception 'CATEGORIA_DESCONOCIDA' using errcode = 'P0001';
  end if;

  -- Servidor (service_role) o actualización interna desde otro trigger.
  if not private.es_usuario_final() or pg_trigger_depth() > 1 then
    return new;
  end if;

  v_gestor := private.tiene_permiso(new.evento_id, 'inscripciones.gestionar');
  v_ventana := private.ventana_evento(new.evento_id);

  if tg_op = 'INSERT' then
    if not v_gestor and v_ventana <> 'ABIERTA' then
      raise exception 'VENTANA_CERRADA' using errcode = 'P0001';
    end if;
    if not v_gestor and (select cupo_fichas from public.evento where id = new.evento_id) is not null
       and (select count(*) from public.ficha f where f.evento_id = new.evento_id and f.estado <> 'RETIRADA')
           >= (select cupo_fichas from public.evento where id = new.evento_id) then
      raise exception 'CUPO_AGOTADO' using errcode = 'P0001';
    end if;
    new.estado := 'BORRADOR';
    new.categoria := null;
    new.validacion := null;
    new.validacion_reglamento_version := null;
    new.excepcion := null;
    new.bloqueada := false;
    new.observacion := null;
    new.creado_por := (select auth.uid());
    return new;
  end if;

  -- UPDATE
  if new.evento_id <> old.evento_id or new.academia_id <> old.academia_id
     or new.inscripcion_id <> old.inscripcion_id or new.coreografia_id <> old.coreografia_id then
    raise exception 'CAMPO_INMUTABLE' using errcode = 'P0001';
  end if;
  -- Derivadas: solo el servidor.
  if new.categoria is distinct from old.categoria
     or new.validacion is distinct from old.validacion
     or new.validacion_reglamento_version is distinct from old.validacion_reglamento_version then
    raise exception 'CAMPO_DERIVADO' using errcode = '42501';
  end if;

  if v_gestor then
    return new;
  end if;

  -- Academia: solo campos de entrada, con ventana abierta y sin bloqueo.
  if new.observacion is distinct from old.observacion
     or new.bloqueada is distinct from old.bloqueada
     or new.excepcion is distinct from old.excepcion then
    raise exception 'CAMPO_RESERVADO_ORGANIZADOR' using errcode = '42501';
  end if;
  if old.bloqueada or v_ventana not in ('ABIERTA', 'SOLO_MODIFICACIONES') then
    raise exception 'FICHA_NO_MODIFICABLE' using errcode = 'P0001';
  end if;
  if new.estado is distinct from old.estado and new.estado not in ('BORRADOR', 'RETIRADA') then
    raise exception 'TRANSICION_RESERVADA' using errcode = '42501';
  end if;
  -- Cambios de entrada invalidan la validación y vuelven a borrador. Los datos
  -- adicionales (OR-16) no intervienen en el reglamento: se editan sin reenviar.
  if (new.nombre, new.genero, new.formacion, new.categoria_declarada, new.musica_path, new.musica_duracion_seg)
     is distinct from
     (old.nombre, old.genero, old.formacion, old.categoria_declarada, old.musica_path, old.musica_duracion_seg) then
    new.validacion := null;
    new.validacion_reglamento_version := null;
    new.categoria := null;
    if new.estado <> 'RETIRADA' then
      new.estado := 'BORRADOR';
    end if;
  end if;
  return new;
end;
$$;

create trigger ficha_guardas before insert or update on public.ficha
  for each row execute function private.guardar_ficha();

-- El elenco de la ficha sigue las mismas reglas de ventana y bloqueo; cambiarlo
-- invalida la validación de la ficha.
create or replace function private.guardar_ficha_bailarin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ficha public.ficha%rowtype;
  v_ficha_id uuid := coalesce(new.ficha_id, old.ficha_id);
begin
  if not private.es_usuario_final() then
    return coalesce(new, old);
  end if;
  select * into v_ficha from public.ficha where id = v_ficha_id;
  if not private.tiene_permiso(v_ficha.evento_id, 'inscripciones.gestionar') then
    if v_ficha.bloqueada or private.ventana_evento(v_ficha.evento_id) not in ('ABIERTA', 'SOLO_MODIFICACIONES') then
      raise exception 'FICHA_NO_MODIFICABLE' using errcode = 'P0001';
    end if;
    if tg_op <> 'DELETE' and (new.edad is not null or new.categoria is not null) then
      if tg_op = 'INSERT' or new.edad is distinct from old.edad or new.categoria is distinct from old.categoria then
        raise exception 'CAMPO_DERIVADO' using errcode = '42501';
      end if;
    end if;
  end if;
  update public.ficha
     set validacion = null, validacion_reglamento_version = null, categoria = null,
         estado = case when estado = 'RETIRADA' then estado else 'BORRADOR' end
   where id = v_ficha_id and (validacion is not null or estado in ('ENVIADA', 'OBSERVADA', 'APROBADA'));
  return coalesce(new, old);
end;
$$;

create trigger ficha_bailarin_guardas before insert or update or delete on public.ficha_bailarin
  for each row execute function private.guardar_ficha_bailarin();

-- La inscripción nueva requiere ventana abierta (salvo organizador).
create or replace function private.guardar_inscripcion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.es_usuario_final() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if not private.tiene_permiso(new.evento_id, 'inscripciones.gestionar')
       and private.ventana_evento(new.evento_id) <> 'ABIERTA' then
      raise exception 'VENTANA_CERRADA' using errcode = 'P0001';
    end if;
    new.creado_por := (select auth.uid());
    new.inscripta_at := now();
  elsif new.evento_id <> old.evento_id or new.academia_id <> old.academia_id
        or new.inscripta_at <> old.inscripta_at then
    raise exception 'CAMPO_INMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger inscripcion_guardas before insert or update on public.inscripcion
  for each row execute function private.guardar_inscripcion();

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
-- Academia: miembros; organizadores de eventos donde está inscripta; cualquiera puede crear la suya.
create policy academia_lectura on public.academia for select to authenticated
  using (
    id in (select private.academias_del_usuario())
    or id in (select private.academias_en_eventos_con_permiso('inscripciones.ver'))
    or id in (select private.academias_en_eventos_con_permiso('orden.ver'))
    or (select private.es_super_admin())
  );
create policy academia_alta on public.academia for insert to authenticated
  with check (creado_por = (select auth.uid()));
create policy academia_edicion on public.academia for update to authenticated
  using (id in (select private.academias_del_usuario()) or (select private.es_super_admin()))
  with check (id in (select private.academias_del_usuario()) or (select private.es_super_admin()));

create policy academia_miembro_lectura on public.academia_miembro for select to authenticated
  using (academia_id in (select private.academias_del_usuario()) or (select private.es_super_admin()));
create policy academia_miembro_gestion on public.academia_miembro for all to authenticated
  using (academia_id in (select private.academias_titular()) or (select private.es_super_admin()))
  with check (academia_id in (select private.academias_titular()) or (select private.es_super_admin()));

create policy academia_invitacion_gestion on public.academia_invitacion for all to authenticated
  using (academia_id in (select private.academias_titular()))
  with check (academia_id in (select private.academias_titular()) and invitado_por = (select auth.uid()));

-- Invitaciones (PR-04): quien recibe la invitación todavía no es miembro, así
-- que ve y acepta por token con funciones acotadas. Aceptar exige que el email
-- de la cuenta coincida con el invitado: reenviar el enlace no da acceso.
create or replace function public.ver_invitacion(p_token text)
returns table (academia text, vencida boolean, aceptada boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.nombre, i.vence_at <= now(), i.aceptada_at is not null
    from public.academia_invitacion i
    join public.academia a on a.id = i.academia_id
   where i.token = p_token and (select auth.uid()) is not null
$$;

create or replace function public.aceptar_invitacion(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.academia_invitacion%rowtype;
  v_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'SIN_SESION' using errcode = '42501';
  end if;
  select * into v_inv from public.academia_invitacion where token = p_token for update;
  if not found then
    raise exception 'INVITACION_INEXISTENTE' using errcode = 'P0002';
  end if;
  if v_inv.aceptada_at is not null then
    raise exception 'INVITACION_USADA' using errcode = 'P0001';
  end if;
  if v_inv.vence_at <= now() then
    raise exception 'INVITACION_VENCIDA' using errcode = 'P0001';
  end if;
  select email into v_email from auth.users where id = (select auth.uid());
  if lower(coalesce(v_email, '')) <> lower(v_inv.email) then
    raise exception 'EMAIL_DISTINTO' using errcode = '42501';
  end if;
  insert into public.academia_miembro (academia_id, usuario_id, rol)
  values (v_inv.academia_id, (select auth.uid()), 'PROFESOR')
  on conflict (academia_id, usuario_id) do update set activo = true;
  update public.academia_invitacion set aceptada_at = now() where id = v_inv.id;
  return v_inv.academia_id;
end;
$$;
revoke execute on function public.ver_invitacion(text), public.aceptar_invitacion(text) from public, anon;
grant execute on function public.ver_invitacion(text), public.aceptar_invitacion(text) to authenticated;

-- Perfiles de los miembros de mis academias.
create policy perfil_academia_lectura on public.perfil for select to authenticated
  using (
    id in (
      select am.usuario_id from public.academia_miembro am
       where am.academia_id in (select private.academias_del_usuario())
    )
  );

-- Bailarín: academia propietaria; organizador y acreditación de eventos donde baila.
create policy bailarin_lectura on public.bailarin for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or (select private.es_super_admin())
    or id in (
      select fb.bailarin_id from public.ficha_bailarin fb
       where fb.evento_id in (select private.eventos_con_permiso('inscripciones.ver'))
          or fb.evento_id in (select private.eventos_con_permiso('acreditacion.operar'))
    )
  );
create policy bailarin_escritura on public.bailarin for insert to authenticated
  with check (academia_id in (select private.academias_del_usuario()));
create policy bailarin_edicion on public.bailarin for update to authenticated
  using (academia_id in (select private.academias_del_usuario()))
  with check (academia_id in (select private.academias_del_usuario()));

-- Coreografía y elenco: academia propietaria; staff de eventos donde está inscripta.
create policy coreografia_lectura on public.coreografia for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or (select private.es_super_admin())
    or id in (
      select f.coreografia_id from public.ficha f
       where f.evento_id in (select private.eventos_con_permiso('inscripciones.ver'))
          or f.evento_id in (select private.eventos_con_permiso('musica.descargar'))
    )
  );
create policy coreografia_escritura on public.coreografia for insert to authenticated
  with check (academia_id in (select private.academias_del_usuario()));
create policy coreografia_edicion on public.coreografia for update to authenticated
  using (academia_id in (select private.academias_del_usuario()))
  with check (academia_id in (select private.academias_del_usuario()));

create policy coreografia_bailarin_lectura on public.coreografia_bailarin for select to authenticated
  using (academia_id in (select private.academias_del_usuario()) or (select private.es_super_admin()));
create policy coreografia_bailarin_escritura on public.coreografia_bailarin for all to authenticated
  using (academia_id in (select private.academias_del_usuario()))
  with check (academia_id in (select private.academias_del_usuario()));

-- Inscripción
create policy inscripcion_lectura on public.inscripcion for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.ver'))
    or evento_id in (select private.eventos_con_permiso('liquidaciones.ver'))
  );
create policy inscripcion_alta on public.inscripcion for insert to authenticated
  with check (
    (academia_id in (select private.academias_del_usuario())
      and evento_id in (select e.id from public.evento e where e.publicado))
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );
create policy inscripcion_edicion on public.inscripcion for update to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  )
  with check (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );

-- Ajustes de liquidación: los ve la academia; los gestiona el organizador.
create policy ajuste_lectura on public.ajuste_liquidacion for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('liquidaciones.ver'))
  );
create policy ajuste_gestion on public.ajuste_liquidacion for insert to authenticated
  with check (
    evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
    and creado_por = (select auth.uid())
  );
create policy ajuste_anulacion on public.ajuste_liquidacion for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')))
  with check (evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')));

-- Ficha
create policy ficha_lectura on public.ficha for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.ver'))
    or evento_id in (select private.eventos_con_permiso('orden.ver'))
  );
create policy ficha_alta on public.ficha for insert to authenticated
  with check (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );
create policy ficha_edicion on public.ficha for update to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  )
  with check (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );

-- Elenco de la ficha: sin documento ni fecha de nacimiento; visible para orden.ver (locutor).
create policy ficha_bailarin_lectura on public.ficha_bailarin for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.ver'))
    or evento_id in (select private.eventos_con_permiso('orden.ver'))
  );
create policy ficha_bailarin_escritura on public.ficha_bailarin for all to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  )
  with check (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );

create policy campo_adicional_lectura on public.campo_adicional for select to authenticated
  using (evento_id in (select e.id from public.evento e where e.publicado) or evento_id in (select private.eventos_miembro()));
create policy campo_adicional_gestion on public.campo_adicional for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));

create policy solicitud_lectura on public.solicitud_modificacion for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar'))
  );
create policy solicitud_alta on public.solicitud_modificacion for insert to authenticated
  with check (academia_id in (select private.academias_del_usuario()) and creado_por = (select auth.uid()) and estado = 'PENDIENTE');
create policy solicitud_resolucion on public.solicitud_modificacion for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')))
  with check (evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')));

grant execute on function
  private.academias_del_usuario(),
  private.academias_titular(),
  private.academias_en_eventos_con_permiso(text)
to authenticated, service_role;
