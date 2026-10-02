-- =============================================================================
-- SOED · 0700 · Acreditación, comunicaciones, hoteles, clases y entradas
-- La acreditación nunca consulta cobros (TR-12, OP-25).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Acreditación (F5)
-- -----------------------------------------------------------------------------
create table public.credencial (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  tipo text not null check (tipo in ('BAILARIN', 'PROFESOR', 'STAFF', 'JURADO', 'ACOMPANANTE')),
  academia_id uuid references public.academia (id) on delete restrict,
  bailarin_id uuid,
  usuario_id uuid references auth.users (id) on delete set null,
  nombre_mostrado text not null check (char_length(nombre_mostrado) <= 250),
  zonas text[] not null default '{}',
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  acreditado_at timestamptz,
  acreditado_por uuid references auth.users (id) on delete set null,
  anulada boolean not null default false,
  creado_at timestamptz not null default now(),
  unique (evento_id, bailarin_id),
  foreign key (bailarin_id, academia_id) references public.bailarin (id, academia_id) on delete restrict
);
create index credencial_evento_idx on public.credencial (evento_id);
create index credencial_academia_idx on public.credencial (academia_id);
create index credencial_bailarin_idx on public.credencial (bailarin_id, academia_id);
create index credencial_usuario_idx on public.credencial (usuario_id);
create index credencial_acreditado_por_idx on public.credencial (acreditado_por);
create index credencial_nombre_trgm_idx on public.credencial using gin (nombre_mostrado extensions.gin_trgm_ops);
alter table public.credencial enable row level security;

create table public.acreditacion_registro (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  credencial_id uuid not null references public.credencial (id) on delete cascade,
  accion text not null check (accion in ('ACREDITAR', 'INGRESO_ZONA')),
  zona text,
  client_uuid uuid not null unique,
  registrado_por uuid not null references auth.users (id) on delete restrict,
  registrado_at timestamptz not null default now(),
  dispositivo_at timestamptz
);
create index acreditacion_registro_evento_idx on public.acreditacion_registro (evento_id);
create index acreditacion_registro_credencial_idx on public.acreditacion_registro (credencial_id);
create index acreditacion_registro_registrado_por_idx on public.acreditacion_registro (registrado_por);
alter table public.acreditacion_registro enable row level security;

-- Registrar una acreditación marca la credencial (idempotente).
create or replace function private.aplicar_acreditacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.es_usuario_final() then
    new.registrado_por := (select auth.uid());
    new.registrado_at := now();
  end if;
  if new.accion = 'ACREDITAR' then
    update public.credencial
       set acreditado_at = coalesce(acreditado_at, coalesce(new.dispositivo_at, now())),
           acreditado_por = coalesce(acreditado_por, new.registrado_por)
     where id = new.credencial_id and evento_id = new.evento_id and not anulada;
  end if;
  return new;
end;
$$;
create trigger acreditacion_registro_aplicar before insert on public.acreditacion_registro
  for each row execute function private.aplicar_acreditacion();

create policy credencial_lectura on public.credencial for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or usuario_id = (select auth.uid())
    or evento_id in (select private.eventos_con_permiso('acreditacion.operar'))
  );
create policy credencial_gestion on public.credencial for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('acreditacion.operar')))
  with check (evento_id in (select private.eventos_con_permiso('acreditacion.operar')));

create policy acreditacion_registro_lectura on public.acreditacion_registro for select to authenticated
  using (evento_id in (select private.eventos_con_permiso('acreditacion.operar')));
create policy acreditacion_registro_alta on public.acreditacion_registro for insert to authenticated
  with check (evento_id in (select private.eventos_con_permiso('acreditacion.operar')));

-- -----------------------------------------------------------------------------
-- Comunicados y cola de emails (F4, ADR-0013)
-- -----------------------------------------------------------------------------
create table public.comunicado (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  asunto jsonb not null check (private.es_traducible(asunto)),
  cuerpo jsonb not null check (private.es_traducible(cuerpo)),
  audiencia text[] not null check (audiencia <@ array['ACADEMIAS', 'JURADOS', 'STAFF']::text[] and cardinality(audiencia) > 0),
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR', 'ENCOLADO', 'ENVIADO')),
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz
);
create index comunicado_evento_idx on public.comunicado (evento_id);
create index comunicado_creado_por_idx on public.comunicado (creado_por);
alter table public.comunicado enable row level security;

create table public.email_envio (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references public.evento (id) on delete set null,
  usuario_id uuid references auth.users (id) on delete set null,
  destinatario text not null check (char_length(destinatario) <= 320),
  plantilla text not null check (plantilla ~ '^[a-z0-9_]+$'),
  idioma text not null references public.idioma (codigo),
  payload jsonb not null default '{}'::jsonb,
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'SIMULADO')),
  proveedor_id text,
  error text,
  intentos smallint not null default 0,
  creado_at timestamptz not null default now(),
  enviado_at timestamptz
);
create index email_envio_evento_idx on public.email_envio (evento_id);
create index email_envio_usuario_idx on public.email_envio (usuario_id);
create index email_envio_idioma_idx on public.email_envio (idioma);
create index email_envio_pendiente_idx on public.email_envio (creado_at) where estado = 'PENDIENTE';
alter table public.email_envio enable row level security;

create policy comunicado_lectura on public.comunicado for select to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('comunicados.enviar'))
    or (
      estado = 'ENVIADO'
      and (
        ('ACADEMIAS' = any (audiencia) and evento_id in (
          select i.evento_id from public.inscripcion i where i.academia_id in (select private.academias_del_usuario())
        ))
        or ('JURADOS' = any (audiencia) and evento_id in (select private.eventos_con_permiso('puntajes.cargar')))
        or ('STAFF' = any (audiencia) and evento_id in (select private.eventos_miembro()))
      )
    )
  );
create policy comunicado_gestion on public.comunicado for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('comunicados.enviar')))
  with check (evento_id in (select private.eventos_con_permiso('comunicados.enviar')));

-- La cola de emails solo la ve quien envía comunicados; la escribe el servidor.
create policy email_envio_lectura on public.email_envio for select to authenticated
  using ((select private.es_super_admin()) or evento_id in (select private.eventos_con_permiso('comunicados.enviar')));

-- -----------------------------------------------------------------------------
-- Hoteles y paquetes (OR-09, PR-30)
-- -----------------------------------------------------------------------------
create table public.hotel (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  nombre text not null check (char_length(nombre) <= 200),
  descripcion jsonb not null default '{}'::jsonb check (private.es_traducible(descripcion)),
  cupo integer not null check (cupo >= 0),
  precio_centavos bigint check (precio_centavos >= 0),
  criterio_asignacion text not null default 'PRIMER_PAGO' check (criterio_asignacion in ('PRIMER_PAGO', 'INSCRIPCION')),
  unique (id, evento_id)
);
create index hotel_evento_idx on public.hotel (evento_id);
alter table public.hotel enable row level security;

create table public.hotel_solicitud (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null,
  evento_id uuid not null,
  academia_id uuid not null,
  inscripcion_id uuid not null,
  plazas integer not null check (plazas > 0),
  creado_at timestamptz not null default now(),
  unique (hotel_id, inscripcion_id),
  foreign key (hotel_id, evento_id) references public.hotel (id, evento_id) on delete cascade,
  foreign key (inscripcion_id, evento_id, academia_id) references public.inscripcion (id, evento_id, academia_id) on delete cascade
);
create index hotel_solicitud_hotel_idx on public.hotel_solicitud (hotel_id, evento_id);
create index hotel_solicitud_inscripcion_idx on public.hotel_solicitud (inscripcion_id, evento_id, academia_id);
create index hotel_solicitud_academia_idx on public.hotel_solicitud (academia_id);
alter table public.hotel_solicitud enable row level security;

create policy hotel_lectura on public.hotel for select to authenticated
  using (evento_id in (select e.id from public.evento e where e.publicado) or evento_id in (select private.eventos_miembro()));
create policy hotel_gestion on public.hotel for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));
create policy hotel_solicitud_lectura on public.hotel_solicitud for select to authenticated
  using (academia_id in (select private.academias_del_usuario()) or evento_id in (select private.eventos_con_permiso('inscripciones.ver')));
create policy hotel_solicitud_gestion on public.hotel_solicitud for all to authenticated
  using (academia_id in (select private.academias_del_usuario()) or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')))
  with check (academia_id in (select private.academias_del_usuario()) or evento_id in (select private.eventos_con_permiso('inscripciones.gestionar')));

-- -----------------------------------------------------------------------------
-- Clases y entradas con cobro manual (F6). Las reservas públicas entran por
-- servidor (validación, rate limit y anti-spam), nunca directo desde anon.
-- -----------------------------------------------------------------------------
create table public.clase (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  nombre jsonb not null check (private.es_traducible(nombre)),
  docente text check (char_length(docente) <= 200),
  sala text check (char_length(sala) <= 120),
  inicio timestamptz not null,
  fin timestamptz not null,
  cupo integer not null check (cupo >= 0),
  precio_centavos bigint not null default 0 check (precio_centavos >= 0),
  publicada boolean not null default false,
  check (fin > inicio),
  unique (id, evento_id)
);
create index clase_evento_idx on public.clase (evento_id);
alter table public.clase enable row level security;

create table public.reserva_clase (
  id uuid primary key default gen_random_uuid(),
  clase_id uuid not null,
  evento_id uuid not null,
  academia_id uuid references public.academia (id) on delete set null,
  nombre text not null check (char_length(nombre) <= 200),
  email text check (char_length(email) <= 320),
  estado text not null default 'RESERVADA' check (estado in ('RESERVADA', 'CONFIRMADA', 'CANCELADA')),
  pagada boolean not null default false,
  cobrado_por uuid references auth.users (id) on delete set null,
  cobrado_at timestamptz,
  creado_at timestamptz not null default now(),
  foreign key (clase_id, evento_id) references public.clase (id, evento_id) on delete cascade
);
create index reserva_clase_clase_idx on public.reserva_clase (clase_id, evento_id);
create index reserva_clase_evento_idx on public.reserva_clase (evento_id);
create index reserva_clase_academia_idx on public.reserva_clase (academia_id);
create index reserva_clase_cobrado_por_idx on public.reserva_clase (cobrado_por);
alter table public.reserva_clase enable row level security;

create table public.entrada_tipo (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  nombre jsonb not null check (private.es_traducible(nombre)),
  fecha date,
  cupo integer not null check (cupo >= 0),
  precio_centavos bigint not null check (precio_centavos >= 0),
  publicada boolean not null default false,
  unique (id, evento_id)
);
create index entrada_tipo_evento_idx on public.entrada_tipo (evento_id);
alter table public.entrada_tipo enable row level security;

create table public.reserva_entrada (
  id uuid primary key default gen_random_uuid(),
  entrada_tipo_id uuid not null,
  evento_id uuid not null,
  nombre text not null check (char_length(nombre) <= 200),
  email text not null check (char_length(email) <= 320),
  cantidad integer not null check (cantidad between 1 and 20),
  estado text not null default 'RESERVADA' check (estado in ('RESERVADA', 'CONFIRMADA', 'CANCELADA')),
  pagada boolean not null default false,
  codigo text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  cobrado_por uuid references auth.users (id) on delete set null,
  cobrado_at timestamptz,
  creado_at timestamptz not null default now(),
  foreign key (entrada_tipo_id, evento_id) references public.entrada_tipo (id, evento_id) on delete cascade
);
create index reserva_entrada_tipo_idx on public.reserva_entrada (entrada_tipo_id, evento_id);
create index reserva_entrada_evento_idx on public.reserva_entrada (evento_id);
create index reserva_entrada_cobrado_por_idx on public.reserva_entrada (cobrado_por);
alter table public.reserva_entrada enable row level security;

create policy clase_lectura on public.clase for select to authenticated
  using (publicada or evento_id in (select private.eventos_miembro()));
create policy clase_gestion on public.clase for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));
create policy reserva_clase_lectura on public.reserva_clase for select to authenticated
  using (academia_id in (select private.academias_del_usuario()) or evento_id in (select private.eventos_con_permiso('cobros.registrar')));
create policy reserva_clase_academia on public.reserva_clase for insert to authenticated
  with check (academia_id in (select private.academias_del_usuario()) and not pagada and estado = 'RESERVADA');
create policy reserva_clase_gestion on public.reserva_clase for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('cobros.registrar')))
  with check (evento_id in (select private.eventos_con_permiso('cobros.registrar')));

create policy entrada_tipo_lectura on public.entrada_tipo for select to authenticated
  using (publicada or evento_id in (select private.eventos_miembro()));
create policy entrada_tipo_gestion on public.entrada_tipo for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));
create policy reserva_entrada_gestion on public.reserva_entrada for select to authenticated
  using (evento_id in (select private.eventos_con_permiso('cobros.registrar')));
create policy reserva_entrada_cobro on public.reserva_entrada for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('cobros.registrar')))
  with check (evento_id in (select private.eventos_con_permiso('cobros.registrar')));

-- -----------------------------------------------------------------------------
-- Cupos de clases y entradas: se verifican con bloqueo de la fila padre, así
-- dos reservas simultáneas no superan el cupo (OR-51, OR-52).
-- -----------------------------------------------------------------------------
create or replace function private.verificar_cupo_clase()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clase public.clase;
  v_ocupadas integer;
begin
  if new.estado = 'CANCELADA' then
    return new;
  end if;
  select * into v_clase from public.clase where id = new.clase_id for update;
  if not v_clase.publicada then
    raise exception 'CLASE_NO_DISPONIBLE';
  end if;
  select count(*) into v_ocupadas
    from public.reserva_clase
   where clase_id = new.clase_id and estado <> 'CANCELADA' and id <> new.id;
  if v_ocupadas + 1 > v_clase.cupo then
    raise exception 'SIN_CUPO';
  end if;
  return new;
end;
$$;
create trigger reserva_clase_cupo before insert or update of estado on public.reserva_clase
  for each row execute function private.verificar_cupo_clase();

create or replace function private.verificar_cupo_entrada()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.entrada_tipo;
  v_ocupadas integer;
begin
  if new.estado = 'CANCELADA' then
    return new;
  end if;
  select * into v_tipo from public.entrada_tipo where id = new.entrada_tipo_id for update;
  if not v_tipo.publicada then
    raise exception 'ENTRADA_NO_DISPONIBLE';
  end if;
  select coalesce(sum(cantidad), 0) into v_ocupadas
    from public.reserva_entrada
   where entrada_tipo_id = new.entrada_tipo_id and estado <> 'CANCELADA' and id <> new.id;
  if v_ocupadas + new.cantidad > v_tipo.cupo then
    raise exception 'SIN_CUPO';
  end if;
  return new;
end;
$$;
create trigger reserva_entrada_cupo before insert or update of estado, cantidad on public.reserva_entrada
  for each row execute function private.verificar_cupo_entrada();

-- -----------------------------------------------------------------------------
-- Límite de frecuencia en Postgres (TR-34, sin Redis): ventana fija por clave.
-- La clave la arma el servidor (hash de IP o email); nunca el cliente.
-- -----------------------------------------------------------------------------
create table private.limite_frecuencia (
  clave text not null,
  ventana timestamptz not null,
  conteo integer not null default 0,
  primary key (clave, ventana)
);
alter table private.limite_frecuencia enable row level security;
create index limite_frecuencia_ventana_idx on private.limite_frecuencia (ventana);

create or replace function private.consumir_limite(p_clave text, p_maximo integer, p_ventana interval)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_ventana)) * extract(epoch from p_ventana));
  v_conteo integer;
begin
  -- Limpieza oportunista de ventanas viejas (una por cada consumo, acotada).
  delete from private.limite_frecuencia where ventana < now() - interval '1 day';
  insert into private.limite_frecuencia as l (clave, ventana, conteo) values (p_clave, v_inicio, 1)
  on conflict (clave, ventana) do update set conteo = l.conteo + 1
  returning conteo into v_conteo;
  return v_conteo <= p_maximo;
end;
$$;
revoke execute on function private.consumir_limite(text, integer, interval) from public;

-- -----------------------------------------------------------------------------
-- Reservas públicas (PU-09, PU-10): solo el servidor (service_role) las crea,
-- después de validar el formulario y el anti-spam; aquí se aplican el límite
-- de frecuencia por origen y por email, la publicación y el cupo.
-- -----------------------------------------------------------------------------
create or replace function public.reservar_entrada(
  p_entrada_tipo_id uuid,
  p_nombre text,
  p_email text,
  p_cantidad integer,
  p_origen text
)
returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo public.entrada_tipo;
begin
  select t.* into v_tipo
    from public.entrada_tipo t join public.evento e on e.id = t.evento_id
   where t.id = p_entrada_tipo_id and t.publicada and e.publicado;
  if v_tipo.id is null then
    raise exception 'ENTRADA_NO_DISPONIBLE';
  end if;
  if not private.consumir_limite('reserva:origen:' || p_origen, 5, interval '10 minutes')
     or not private.consumir_limite('reserva:email:' || lower(p_email), 3, interval '1 hour') then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;
  return query
    insert into public.reserva_entrada as r (entrada_tipo_id, evento_id, nombre, email, cantidad)
    values (v_tipo.id, v_tipo.evento_id, btrim(p_nombre), lower(btrim(p_email)), p_cantidad)
    returning r.id, r.codigo;
end;
$$;

create or replace function public.reservar_clase(
  p_clase_id uuid,
  p_nombre text,
  p_email text,
  p_origen text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_clase public.clase;
  v_id uuid;
begin
  select c.* into v_clase
    from public.clase c join public.evento e on e.id = c.evento_id
   where c.id = p_clase_id and c.publicada and e.publicado;
  if v_clase.id is null then
    raise exception 'CLASE_NO_DISPONIBLE';
  end if;
  if not private.consumir_limite('reserva:origen:' || p_origen, 5, interval '10 minutes')
     or not private.consumir_limite('reserva:email:' || lower(p_email), 3, interval '1 hour') then
    raise exception 'DEMASIADOS_INTENTOS';
  end if;
  insert into public.reserva_clase (clase_id, evento_id, nombre, email)
  values (v_clase.id, v_clase.evento_id, btrim(p_nombre), lower(btrim(p_email)))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.reservar_entrada(uuid, text, text, integer, text), public.reservar_clase(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.reservar_entrada(uuid, text, text, integer, text), public.reservar_clase(uuid, text, text, text)
  to service_role;
