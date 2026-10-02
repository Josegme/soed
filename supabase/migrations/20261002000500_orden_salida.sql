-- =============================================================================
-- SOED · 0500 · Pistas, bloques y orden de salida en vivo (ADR-0012)
-- =============================================================================

create table public.pista (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  nombre jsonb not null check (private.es_traducible(nombre)),
  orden smallint not null default 1,
  unique (id, evento_id)
);
create index pista_evento_idx on public.pista (evento_id);
alter table public.pista enable row level security;

create table public.bloque (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  pista_id uuid not null,
  nombre jsonb not null check (private.es_traducible(nombre)),
  inicio_programado timestamptz,
  orden smallint not null default 1,
  unique (id, evento_id),
  unique (id, pista_id),
  foreign key (pista_id, evento_id) references public.pista (id, evento_id) on delete cascade
);
create index bloque_pista_idx on public.bloque (pista_id, evento_id);
create index bloque_evento_idx on public.bloque (evento_id);
alter table public.bloque enable row level security;

create table public.orden_item (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  pista_id uuid not null,
  bloque_id uuid not null,
  ficha_id uuid not null,
  posicion integer not null check (posicion > 0),
  estado text not null default 'PROGRAMADA'
    check (estado in ('PROGRAMADA', 'LLAMADA', 'EN_ESCENA', 'PRESENTADA', 'AUSENTE')),
  actualizado_por uuid references auth.users (id) on delete set null,
  actualizado_at timestamptz not null default now(),
  unique (evento_id, ficha_id),
  constraint orden_item_posicion_unq unique (bloque_id, posicion) deferrable initially deferred,
  foreign key (bloque_id, evento_id) references public.bloque (id, evento_id) on delete cascade,
  foreign key (bloque_id, pista_id) references public.bloque (id, pista_id) on delete cascade,
  foreign key (ficha_id) references public.ficha (id) on delete cascade
);
create index orden_item_evento_idx on public.orden_item (evento_id);
create index orden_item_bloque_evento_idx on public.orden_item (bloque_id, evento_id);
create index orden_item_pista_idx on public.orden_item (bloque_id, pista_id);
create index orden_item_ficha_idx on public.orden_item (ficha_id);
create index orden_item_actualizado_por_idx on public.orden_item (actualizado_por);
-- Una sola coreografía en escena por pista.
create unique index orden_item_en_escena_unq on public.orden_item (pista_id) where estado = 'EN_ESCENA';
alter table public.orden_item enable row level security;

create or replace function private.tocar_orden_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_at := now();
  new.actualizado_por := coalesce((select auth.uid()), new.actualizado_por);
  return new;
end;
$$;
create trigger orden_item_tocar before insert or update on public.orden_item
  for each row execute function private.tocar_orden_item();

-- Reordenar o mover entre bloques de forma atómica (OR-38, OP-08, OP-09).
create or replace function public.reordenar_orden(p_item uuid, p_bloque_destino uuid, p_posicion integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.orden_item%rowtype;
  v_destino public.bloque%rowtype;
  v_total integer;
begin
  select * into v_item from public.orden_item where id = p_item for update;
  if not found then
    raise exception 'ITEM_INEXISTENTE' using errcode = 'P0002';
  end if;
  if not private.tiene_permiso(v_item.evento_id, 'orden.editar') then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  select * into v_destino from public.bloque where id = p_bloque_destino and evento_id = v_item.evento_id;
  if not found then
    raise exception 'BLOQUE_INEXISTENTE' using errcode = 'P0002';
  end if;

  perform 1 from public.orden_item where bloque_id in (v_item.bloque_id, p_bloque_destino) for update;
  select count(*) into v_total from public.orden_item where bloque_id = p_bloque_destino and id <> p_item;
  if p_posicion < 1 or p_posicion > v_total + 1 then
    raise exception 'POSICION_INVALIDA' using errcode = 'P0001';
  end if;

  -- Cerrar el hueco en el origen.
  update public.orden_item set posicion = posicion - 1
   where bloque_id = v_item.bloque_id and posicion > v_item.posicion;
  -- Abrir lugar en el destino.
  update public.orden_item set posicion = posicion + 1
   where bloque_id = p_bloque_destino and id <> p_item
     and posicion >= p_posicion;
  update public.orden_item
     set bloque_id = p_bloque_destino, pista_id = v_destino.pista_id, posicion = p_posicion
   where id = p_item;
end;
$$;
revoke execute on function public.reordenar_orden(uuid, uuid, integer) from public, anon;
grant execute on function public.reordenar_orden(uuid, uuid, integer) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
create policy pista_lectura on public.pista for select to authenticated
  using (evento_id in (select e.id from public.evento e where e.publicado) or evento_id in (select private.eventos_miembro()));
create policy pista_gestion on public.pista for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));

create policy bloque_lectura on public.bloque for select to authenticated
  using (
    evento_id in (select private.eventos_miembro())
    or evento_id in (select private.eventos_orden_publicado())
  );
create policy bloque_gestion on public.bloque for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('orden.editar')))
  with check (evento_id in (select private.eventos_con_permiso('orden.editar')));

-- Orden: staff con orden.ver; academias ven el orden publicado de su evento.
create policy orden_item_lectura on public.orden_item for select to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('orden.ver'))
    or (
      evento_id in (select private.eventos_orden_publicado())
      and ficha_id in (
        select f.id from public.ficha f where f.academia_id in (select private.academias_del_usuario())
      )
    )
  );
create policy orden_item_alta on public.orden_item for insert to authenticated
  with check (evento_id in (select private.eventos_con_permiso('orden.editar')));
create policy orden_item_estado on public.orden_item for update to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('orden.operar'))
    or evento_id in (select private.eventos_con_permiso('orden.editar'))
  )
  with check (
    evento_id in (select private.eventos_con_permiso('orden.operar'))
    or evento_id in (select private.eventos_con_permiso('orden.editar'))
  );
create policy orden_item_baja on public.orden_item for delete to authenticated
  using (evento_id in (select private.eventos_con_permiso('orden.editar')));

-- Tiempo real (ADR-0012)
alter publication supabase_realtime add table public.orden_item;
