-- =============================================================================
-- SOED · 0100 · Base, catálogos e identidad
-- ADR-0002, ADR-0005, ADR-0007. Toda tabla con RLS en la misma migración.
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
alter default privileges in schema private revoke execute on functions from public;

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------
create or replace function private.set_actualizado_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_at := now();
  return new;
end;
$$;

-- true si la sesión es un usuario final (no service_role ni migraciones).
create or replace function private.es_usuario_final()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.role(), '') in ('authenticated', 'anon')
$$;

-- Contenido traducible: objeto jsonb con claves de idioma y valores string.
create or replace function private.es_traducible(valor jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(valor) = 'object'
     and not exists (
       select 1 from jsonb_each(valor) e where jsonb_typeof(e.value) <> 'string'
     )
$$;

-- -----------------------------------------------------------------------------
-- Catálogos extensibles: idiomas y monedas (agregar = insertar fila)
-- -----------------------------------------------------------------------------
create table public.idioma (
  codigo text primary key check (codigo ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  nombre text not null,
  activo boolean not null default true
);
alter table public.idioma enable row level security;
create policy idioma_lectura on public.idioma for select to anon, authenticated using (true);

create table public.moneda (
  codigo text primary key check (codigo ~ '^[A-Z]{3}$'),
  decimales smallint not null default 2 check (decimales between 0 and 4),
  activo boolean not null default true
);
alter table public.moneda enable row level security;
create policy moneda_lectura on public.moneda for select to anon, authenticated using (true);

insert into public.idioma (codigo, nombre) values ('es', 'Español'), ('pt-BR', 'Português (Brasil)');
insert into public.moneda (codigo, decimales) values ('BRL', 2), ('ARS', 2), ('USD', 2);

-- -----------------------------------------------------------------------------
-- Perfil (1:1 con auth.users)
-- -----------------------------------------------------------------------------
create table public.perfil (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '' check (char_length(nombre) <= 200),
  email text check (char_length(email) <= 320),
  telefono text check (char_length(telefono) <= 40),
  idioma text not null default 'es' references public.idioma (codigo),
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index perfil_idioma_idx on public.perfil (idioma);
alter table public.perfil enable row level security;

create trigger perfil_actualizado_at before update on public.perfil
  for each row execute function private.set_actualizado_at();

-- Alta automática del perfil al registrarse.
create or replace function private.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_idioma text := coalesce(new.raw_user_meta_data ->> 'idioma', 'es');
begin
  if not exists (select 1 from public.idioma where codigo = v_idioma) then
    v_idioma := 'es';
  end if;
  insert into public.perfil (id, nombre, email, idioma)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'nombre', ''), new.email, v_idioma)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger crear_perfil_al_registrarse after insert on auth.users
  for each row execute function private.crear_perfil();

-- -----------------------------------------------------------------------------
-- Rol global (Super Admin). Sin escritura desde authenticated (anti escalada).
-- -----------------------------------------------------------------------------
create table public.rol_global (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('SUPER_ADMIN')),
  otorgado_at timestamptz not null default now(),
  otorgado_por uuid references auth.users (id) on delete set null,
  primary key (usuario_id, rol)
);
create index rol_global_otorgado_por_idx on public.rol_global (otorgado_por);
alter table public.rol_global enable row level security;

create or replace function private.es_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rol_global
     where usuario_id = (select auth.uid()) and rol = 'SUPER_ADMIN'
  )
$$;
grant execute on function private.es_super_admin() to anon, authenticated, service_role;

create policy rol_global_lectura on public.rol_global for select to authenticated
  using (usuario_id = (select auth.uid()) or (select private.es_super_admin()));

-- Perfil: cada uno el suyo; Super Admin todos. Los miembros de un mismo evento
-- y academia se ven por la política agregada en 0200 y 0300.
create policy perfil_propio_lectura on public.perfil for select to authenticated
  using (id = (select auth.uid()) or (select private.es_super_admin()));
create policy perfil_propio_edicion on public.perfil for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Permisos y roles de evento (ADR-0007)
-- -----------------------------------------------------------------------------
create table public.permiso (
  codigo text primary key check (codigo ~ '^[a-z]+\.[a-z_]+$'),
  descripcion text not null
);
alter table public.permiso enable row level security;
create policy permiso_lectura on public.permiso for select to authenticated using (true);
create policy permiso_admin on public.permiso for all to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

create table public.rol (
  codigo text primary key check (codigo ~ '^[A-Z_]+$'),
  nombre jsonb not null check (private.es_traducible(nombre)),
  sistema boolean not null default false,
  orden smallint not null default 100
);
alter table public.rol enable row level security;
create policy rol_lectura on public.rol for select to authenticated using (true);
create policy rol_admin on public.rol for all to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

create table public.rol_permiso (
  rol text not null references public.rol (codigo) on delete cascade,
  permiso text not null references public.permiso (codigo) on delete cascade,
  primary key (rol, permiso)
);
create index rol_permiso_permiso_idx on public.rol_permiso (permiso);
alter table public.rol_permiso enable row level security;
create policy rol_permiso_lectura on public.rol_permiso for select to authenticated using (true);
create policy rol_permiso_admin on public.rol_permiso for all to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

insert into public.permiso (codigo, descripcion) values
  ('evento.configurar', 'Configurar datos, reglamento, tarifario, pistas y criterios del evento'),
  ('evento.miembros', 'Asignar organizadores, jurados y staff del evento'),
  ('inscripciones.ver', 'Ver academias, fichas y bailarines inscriptos'),
  ('inscripciones.gestionar', 'Observar, aprobar, bloquear fichas y registrar excepciones'),
  ('liquidaciones.ver', 'Ver liquidaciones y saldos'),
  ('cobros.registrar', 'Registrar cobros'),
  ('cobros.anular', 'Anular cobros con motivo'),
  ('caja.cerrar', 'Cerrar turnos de caja'),
  ('orden.ver', 'Ver el orden de salida completo'),
  ('orden.editar', 'Construir y reordenar el orden de salida'),
  ('orden.operar', 'Cambiar estados del orden en vivo'),
  ('musica.descargar', 'Descargar la música del evento'),
  ('puntajes.cargar', 'Cargar planillas propias de jurado'),
  ('puntajes.supervisar', 'Ver todas las planillas, desvíos y ranking previo'),
  ('resultados.publicar', 'Publicar y despublicar resultados'),
  ('pases.registrar', 'Registrar pases a la final'),
  ('premios.asignar', 'Asignar premios'),
  ('acreditacion.operar', 'Acreditar y emitir credenciales'),
  ('comunicados.enviar', 'Enviar comunicados'),
  ('auditoria.ver', 'Ver el audit log del evento'),
  ('exportar.datos', 'Exportar datos del evento');

insert into public.rol (codigo, nombre, sistema, orden) values
  ('ORGANIZADOR_EVENTO', '{"es":"Organizador del evento","pt-BR":"Organizador do evento"}', true, 10),
  ('DIRECTOR_TECNICO', '{"es":"Director técnico","pt-BR":"Diretor técnico"}', true, 20),
  ('JURADO', '{"es":"Jurado","pt-BR":"Jurado"}', true, 30),
  ('COORDINADOR', '{"es":"Coordinador en vivo","pt-BR":"Coordenador"}', true, 40),
  ('LOCUTOR', '{"es":"Locutor","pt-BR":"Locutor"}', true, 50),
  ('DJ', '{"es":"DJ / Sonido","pt-BR":"DJ / Sonoplastia"}', true, 60),
  ('STAFF_ACREDITACION', '{"es":"Staff de acreditación","pt-BR":"Equipe de credenciamento"}', true, 70);

insert into public.rol_permiso (rol, permiso)
select 'ORGANIZADOR_EVENTO', codigo from public.permiso where codigo <> 'puntajes.cargar';

insert into public.rol_permiso (rol, permiso) values
  ('DIRECTOR_TECNICO', 'orden.ver'),
  ('DIRECTOR_TECNICO', 'puntajes.supervisar'),
  ('JURADO', 'orden.ver'),
  ('JURADO', 'puntajes.cargar'),
  ('COORDINADOR', 'orden.ver'),
  ('COORDINADOR', 'orden.editar'),
  ('COORDINADOR', 'orden.operar'),
  ('LOCUTOR', 'orden.ver'),
  ('DJ', 'orden.ver'),
  ('DJ', 'musica.descargar'),
  ('STAFF_ACREDITACION', 'inscripciones.ver'),
  ('STAFF_ACREDITACION', 'liquidaciones.ver'),
  ('STAFF_ACREDITACION', 'cobros.registrar'),
  ('STAFF_ACREDITACION', 'acreditacion.operar');
