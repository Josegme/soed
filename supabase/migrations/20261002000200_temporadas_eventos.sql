-- =============================================================================
-- SOED · 0200 · Reglamentos, temporadas, eventos y miembros por evento
-- ADR-0004 (eventos independientes), ADR-0006 (reglamento), ADR-0007 (permisos)
-- =============================================================================

-- Estructura mínima del reglamento (la validación completa es Zod + dominio).
create or replace function private.reglamento_estructura_valida(c jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(c) = 'object'
     and (c ->> 'versionEsquema') is not null
     and jsonb_typeof(c -> 'categorias') = 'array'
     and jsonb_typeof(c -> 'formaciones') = 'array'
     and jsonb_typeof(c -> 'generos') = 'array'
     and jsonb_typeof(c -> 'tiempos') = 'array'
     and jsonb_typeof(c -> 'bandas') = 'array'
     and jsonb_typeof(c -> 'toleranciaGrupo') = 'object'
     and jsonb_typeof(c -> 'puntaje') = 'object'
     and jsonb_typeof(c -> 'fechaReferenciaEdad') = 'object'
$$;

-- Códigos definidos en una lista del reglamento ('categorias', 'formaciones', 'generos').
create or replace function private.reglamento_codigos(c jsonb, lista text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(x ->> 'codigo'), '{}') from jsonb_array_elements(c -> lista) x
$$;

-- -----------------------------------------------------------------------------
-- Reglamento (plantillas de temporada)
-- -----------------------------------------------------------------------------
create table public.reglamento (
  id uuid primary key default gen_random_uuid(),
  nombre jsonb not null check (private.es_traducible(nombre)),
  preset text,
  version integer not null default 1 check (version > 0),
  config jsonb not null check (private.reglamento_estructura_valida(config)),
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index reglamento_creado_por_idx on public.reglamento (creado_por);
alter table public.reglamento enable row level security;
create trigger reglamento_actualizado_at before update on public.reglamento
  for each row execute function private.set_actualizado_at();

create policy reglamento_lectura on public.reglamento for select to authenticated using (true);
create policy reglamento_admin on public.reglamento for all to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

-- -----------------------------------------------------------------------------
-- Temporada
-- -----------------------------------------------------------------------------
create table public.temporada (
  id uuid primary key default gen_random_uuid(),
  anio integer not null check (anio between 2000 and 2100),
  nombre jsonb not null check (private.es_traducible(nombre)),
  reglamento_id uuid references public.reglamento (id) on delete restrict,
  publicada boolean not null default false,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now()
);
create index temporada_anio_idx on public.temporada (anio);
create index temporada_reglamento_idx on public.temporada (reglamento_id);
alter table public.temporada enable row level security;
create trigger temporada_actualizado_at before update on public.temporada
  for each row execute function private.set_actualizado_at();

-- -----------------------------------------------------------------------------
-- Evento
-- -----------------------------------------------------------------------------
create table public.evento (
  id uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references public.temporada (id) on delete restrict,
  slug text not null unique check (slug ~ '^[A-Z0-9]{2,16}$'),
  tipo text not null check (tipo in ('SELECTIVO', 'FINAL', 'UNICO')),
  estado text not null default 'BORRADOR'
    check (estado in ('BORRADOR', 'PUBLICADO', 'EN_CURSO', 'FINALIZADO', 'ARCHIVADO')),
  nombre jsonb not null check (private.es_traducible(nombre)),
  idioma_defecto text not null default 'es' references public.idioma (codigo),
  moneda text not null references public.moneda (codigo),
  zona_horaria text not null default 'America/Sao_Paulo' check (char_length(zona_horaria) between 3 and 64),
  sede jsonb not null default '{}'::jsonb check (jsonb_typeof(sede) = 'object'),
  fecha_inicio date not null,
  fecha_fin date not null,
  inscripcion_apertura timestamptz,
  inscripcion_cierre timestamptz,
  modificaciones_cierre timestamptz,
  cupo_fichas integer check (cupo_fichas > 0),
  reglamento jsonb not null check (private.reglamento_estructura_valida(reglamento)),
  reglamento_version integer not null default 1 check (reglamento_version > 0),
  tarifario jsonb not null default '{}'::jsonb check (jsonb_typeof(tarifario) = 'object'),
  medios_cobro text[] not null default array['EFECTIVO', 'MERCADO_PAGO', 'TRANSFERENCIA', 'PIX', 'OTRO'],
  datos_pago jsonb not null default '{}'::jsonb check (private.es_traducible(datos_pago)),
  bases jsonb not null default '{}'::jsonb check (private.es_traducible(bases)),
  acreditacion jsonb not null default '{}'::jsonb check (jsonb_typeof(acreditacion) = 'object'),
  config_operacion jsonb not null default '{}'::jsonb check (jsonb_typeof(config_operacion) = 'object'),
  publicado boolean not null default false,
  orden_publicado_at timestamptz,
  resultados_publicados_at timestamptz,
  creado_por uuid references auth.users (id) on delete set null,
  creado_at timestamptz not null default now(),
  actualizado_at timestamptz not null default now(),
  constraint evento_fechas check (fecha_fin >= fecha_inicio),
  constraint evento_ventana check (
    (inscripcion_cierre is null or inscripcion_apertura is null or inscripcion_cierre > inscripcion_apertura)
    and (modificaciones_cierre is null or inscripcion_cierre is null or modificaciones_cierre >= inscripcion_cierre)
  ),
  constraint evento_tarifario_moneda check (tarifario ->> 'moneda' is null or tarifario ->> 'moneda' = moneda)
);
create index evento_temporada_idx on public.evento (temporada_id);
create index evento_creado_por_idx on public.evento (creado_por);
create index evento_idioma_idx on public.evento (idioma_defecto);
create index evento_moneda_idx on public.evento (moneda);
create index evento_publicado_idx on public.evento (publicado) where publicado;
alter table public.evento enable row level security;
create trigger evento_actualizado_at before update on public.evento
  for each row execute function private.set_actualizado_at();

-- Correlativos por evento (LIQ-<SLUG>-0001). Solo vía private.siguiente_numero.
create table public.evento_contador (
  evento_id uuid not null references public.evento (id) on delete cascade,
  tipo text not null check (tipo in ('LIQUIDACION')),
  ultimo integer not null default 0 check (ultimo >= 0),
  primary key (evento_id, tipo)
);
alter table public.evento_contador enable row level security;

-- -----------------------------------------------------------------------------
-- Miembros por evento
-- -----------------------------------------------------------------------------
create table public.evento_miembro (
  evento_id uuid not null references public.evento (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol text not null references public.rol (codigo),
  activo boolean not null default true,
  asignado_por uuid references auth.users (id) on delete set null,
  asignado_at timestamptz not null default now(),
  primary key (evento_id, usuario_id, rol)
);
create index evento_miembro_usuario_idx on public.evento_miembro (usuario_id) where activo;
create index evento_miembro_rol_idx on public.evento_miembro (rol);
create index evento_miembro_asignado_por_idx on public.evento_miembro (asignado_por);
alter table public.evento_miembro enable row level security;

-- -----------------------------------------------------------------------------
-- Funciones de autorización (security definer, evaluadas una vez por consulta)
-- -----------------------------------------------------------------------------
create or replace function private.eventos_con_permiso(p_permiso text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.evento e where (select private.es_super_admin())
  union
  select em.evento_id
    from public.evento_miembro em
    join public.rol_permiso rp on rp.rol = em.rol
   where em.usuario_id = (select auth.uid())
     and em.activo
     and rp.permiso = p_permiso
$$;

create or replace function private.eventos_miembro()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select e.id from public.evento e where (select private.es_super_admin())
  union
  select em.evento_id from public.evento_miembro em
   where em.usuario_id = (select auth.uid()) and em.activo
$$;

create or replace function private.tiene_permiso(p_evento uuid, p_permiso text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.es_super_admin()) or exists (
    select 1
      from public.evento_miembro em
      join public.rol_permiso rp on rp.rol = em.rol
     where em.evento_id = p_evento
       and em.usuario_id = (select auth.uid())
       and em.activo
       and rp.permiso = p_permiso
  )
$$;

create or replace function private.eventos_resultados_publicados()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.evento
   where resultados_publicados_at is not null and resultados_publicados_at <= now()
$$;

create or replace function private.eventos_orden_publicado()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.evento
   where orden_publicado_at is not null and orden_publicado_at <= now()
$$;

grant execute on function
  private.eventos_con_permiso(text),
  private.eventos_miembro(),
  private.tiene_permiso(uuid, text),
  private.eventos_resultados_publicados(),
  private.eventos_orden_publicado(),
  private.es_usuario_final(),
  private.es_traducible(jsonb),
  private.reglamento_estructura_valida(jsonb),
  private.reglamento_codigos(jsonb, text)
to anon, authenticated, service_role;

-- Siguiente correlativo sin huecos ni duplicados bajo concurrencia (ADR-0009).
create or replace function private.siguiente_numero(p_evento uuid, p_tipo text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numero integer;
begin
  insert into public.evento_contador (evento_id, tipo, ultimo)
  values (p_evento, p_tipo, 1)
  on conflict (evento_id, tipo) do update set ultimo = public.evento_contador.ultimo + 1
  returning ultimo into v_numero;
  return v_numero;
end;
$$;
revoke execute on function private.siguiente_numero(uuid, text) from public, anon, authenticated;
grant execute on function private.siguiente_numero(uuid, text) to service_role;

-- -----------------------------------------------------------------------------
-- Guardas del evento: campos reservados, reglamento versionado, archivado
-- -----------------------------------------------------------------------------
create or replace function private.guardar_evento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin boolean := (select private.es_super_admin());
begin
  if tg_op = 'UPDATE' then
    if old.estado = 'ARCHIVADO' and new.estado = 'ARCHIVADO' and private.es_usuario_final() then
      raise exception 'EVENTO_ARCHIVADO' using errcode = 'P0001';
    end if;
    if private.es_usuario_final() and not v_admin then
      if new.slug is distinct from old.slug or new.temporada_id is distinct from old.temporada_id then
        raise exception 'CAMPO_RESERVADO_SUPER_ADMIN' using errcode = 'P0001';
      end if;
      if (new.resultados_publicados_at is distinct from old.resultados_publicados_at
          or new.orden_publicado_at is distinct from old.orden_publicado_at)
         and not private.tiene_permiso(new.id, 'resultados.publicar') then
        raise exception 'SIN_PERMISO_PUBLICAR' using errcode = '42501';
      end if;
    end if;
    if new.reglamento is distinct from old.reglamento then
      new.reglamento_version := old.reglamento_version + 1;
    end if;
  end if;
  return new;
end;
$$;

create trigger evento_guardas before update on public.evento
  for each row execute function private.guardar_evento();

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
-- Temporada
create policy temporada_lectura on public.temporada for select to authenticated
  using (publicada or (select private.es_super_admin()));
create policy temporada_publica on public.temporada for select to anon using (publicada);
create policy temporada_admin on public.temporada for all to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

-- Evento: autenticados ven los publicados y los propios; anon solo publicados
-- (y solo columnas no sensibles, ver grants en 0900).
create policy evento_lectura on public.evento for select to authenticated
  using (publicado or (select private.es_super_admin()) or id in (select private.eventos_miembro()));
create policy evento_publico on public.evento for select to anon using (publicado);
create policy evento_alta on public.evento for insert to authenticated
  with check ((select private.es_super_admin()));
create policy evento_edicion on public.evento for update to authenticated
  using (id in (select private.eventos_con_permiso('evento.configurar')))
  with check (id in (select private.eventos_con_permiso('evento.configurar')));
create policy evento_baja on public.evento for delete to authenticated
  using ((select private.es_super_admin()));

-- Miembros: los ve el propio usuario y quien gestiona miembros del evento.
create policy evento_miembro_lectura on public.evento_miembro for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or evento_id in (select private.eventos_con_permiso('evento.miembros'))
  );
create policy evento_miembro_alta on public.evento_miembro for insert to authenticated
  with check (
    evento_id in (select private.eventos_con_permiso('evento.miembros'))
    -- solo Super Admin crea organizadores (SA-04)
    and (rol <> 'ORGANIZADOR_EVENTO' or (select private.es_super_admin()))
  );
create policy evento_miembro_edicion on public.evento_miembro for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.miembros')))
  with check (
    evento_id in (select private.eventos_con_permiso('evento.miembros'))
    and (rol <> 'ORGANIZADOR_EVENTO' or (select private.es_super_admin()))
  );
create policy evento_miembro_baja on public.evento_miembro for delete to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('evento.miembros'))
    and (rol <> 'ORGANIZADOR_EVENTO' or (select private.es_super_admin()))
  );

-- Perfiles visibles para quien gestiona miembros del evento donde participan.
create policy perfil_equipo_lectura on public.perfil for select to authenticated
  using (
    id in (
      select em.usuario_id from public.evento_miembro em
       where em.evento_id in (select private.eventos_con_permiso('evento.miembros'))
    )
  );
