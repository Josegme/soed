-- =============================================================================
-- SOED · 0600 · Criterios, planillas, resultados, premios y pases
-- Art. 32 (ADR-0008): notas y comentarios visibles a las academias solo tras
-- la publicación. Pases manuales (TR-13): sin reglas automáticas.
-- =============================================================================

create table public.criterio (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete cascade,
  codigo text not null check (codigo ~ '^[A-Z0-9_]{1,40}$'),
  nombre jsonb not null check (private.es_traducible(nombre)),
  peso numeric(6, 3) not null default 1 check (peso > 0),
  orden smallint not null default 1,
  unique (evento_id, codigo),
  unique (id, evento_id)
);
alter table public.criterio enable row level security;

create table public.planilla (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  ficha_id uuid not null,
  jurado_id uuid not null references auth.users (id) on delete restrict,
  estado text not null default 'BORRADOR' check (estado in ('BORRADOR', 'ENVIADA', 'REABIERTA')),
  comentario text check (char_length(comentario) <= 4000),
  total numeric(8, 4),
  client_uuid uuid unique,
  enviada_at timestamptz,
  reabierta_por uuid references auth.users (id) on delete set null,
  motivo_reapertura text,
  actualizado_at timestamptz not null default now(),
  unique (ficha_id, jurado_id),
  unique (id, evento_id),
  foreign key (ficha_id, evento_id, academia_id) references public.ficha (id, evento_id, academia_id) on delete restrict
);
create index planilla_ficha_idx on public.planilla (ficha_id, evento_id, academia_id);
create index planilla_evento_idx on public.planilla (evento_id);
create index planilla_jurado_idx on public.planilla (jurado_id);
create index planilla_academia_idx on public.planilla (academia_id);
create index planilla_reabierta_por_idx on public.planilla (reabierta_por);
alter table public.planilla enable row level security;

create table public.planilla_nota (
  planilla_id uuid not null,
  criterio_id uuid not null,
  evento_id uuid not null,
  valor numeric(6, 3) not null check (valor >= 0),
  primary key (planilla_id, criterio_id),
  foreign key (planilla_id, evento_id) references public.planilla (id, evento_id) on delete cascade,
  foreign key (criterio_id, evento_id) references public.criterio (id, evento_id) on delete restrict
);
create index planilla_nota_criterio_idx on public.planilla_nota (criterio_id, evento_id);
create index planilla_nota_planilla_idx on public.planilla_nota (planilla_id, evento_id);
alter table public.planilla_nota enable row level security;

-- Guardas de la planilla: el jurado edita la suya hasta enviarla; reabrir requiere supervisión.
create or replace function private.guardar_planilla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supervisor boolean;
begin
  new.actualizado_at := now();
  if not private.es_usuario_final() or pg_trigger_depth() > 1 then
    return new;
  end if;
  v_supervisor := private.tiene_permiso(new.evento_id, 'puntajes.supervisar');
  if tg_op = 'INSERT' then
    new.jurado_id := (select auth.uid());
    new.estado := case when new.estado = 'ENVIADA' then 'ENVIADA' else 'BORRADOR' end;
    new.total := null;
    if new.estado = 'ENVIADA' then
      raise exception 'PLANILLA_SIN_NOTAS' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if new.ficha_id <> old.ficha_id or new.jurado_id <> old.jurado_id or new.evento_id <> old.evento_id then
    raise exception 'CAMPO_INMUTABLE' using errcode = 'P0001';
  end if;
  if new.total is distinct from old.total then
    raise exception 'CAMPO_DERIVADO' using errcode = '42501';
  end if;
  if old.estado = 'ENVIADA' then
    if not (v_supervisor and new.estado = 'REABIERTA') then
      raise exception 'PLANILLA_ENVIADA' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(new.motivo_reapertura, ''))) < 3 then
      raise exception 'MOTIVO_REQUERIDO' using errcode = 'P0001';
    end if;
    new.reabierta_por := (select auth.uid());
    return new;
  end if;
  if new.jurado_id <> (select auth.uid()) then
    raise exception 'SIN_PERMISO' using errcode = '42501';
  end if;
  if new.estado = 'ENVIADA' then
    if exists (
      select 1 from public.criterio c
       where c.evento_id = new.evento_id
         and not exists (select 1 from public.planilla_nota n where n.planilla_id = new.id and n.criterio_id = c.id)
    ) then
      raise exception 'CRITERIO_FALTANTE' using errcode = 'P0001';
    end if;
    new.enviada_at := now();
  end if;
  return new;
end;
$$;
create trigger planilla_guardas before insert or update on public.planilla
  for each row execute function private.guardar_planilla();

-- Notas: escala del reglamento del evento y planilla editable; recalcula el total
-- ponderado (misma fórmula que totalPlanilla del dominio).
create or replace function private.guardar_planilla_nota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_planilla public.planilla%rowtype;
  v_puntaje jsonb;
  v_id uuid := coalesce(new.planilla_id, old.planilla_id);
begin
  select * into v_planilla from public.planilla where id = v_id;
  if private.es_usuario_final() then
    if v_planilla.jurado_id <> (select auth.uid()) then
      raise exception 'SIN_PERMISO' using errcode = '42501';
    end if;
    if v_planilla.estado = 'ENVIADA' then
      raise exception 'PLANILLA_ENVIADA' using errcode = 'P0001';
    end if;
  end if;
  if tg_op <> 'DELETE' then
    select reglamento -> 'puntaje' into v_puntaje from public.evento where id = new.evento_id;
    if new.valor < (v_puntaje ->> 'escalaMin')::numeric or new.valor > (v_puntaje ->> 'escalaMax')::numeric then
      raise exception 'NOTA_FUERA_DE_ESCALA' using errcode = 'P0001';
    end if;
    if new.valor <> round(new.valor, (v_puntaje ->> 'decimalesNota')::integer) then
      raise exception 'DECIMALES_EXCEDIDOS' using errcode = 'P0001';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
create trigger planilla_nota_guardas before insert or update or delete on public.planilla_nota
  for each row execute function private.guardar_planilla_nota();

create or replace function private.recalcular_total_planilla()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.planilla_id, old.planilla_id);
begin
  update public.planilla p
     set total = (
       select sum(n.valor * c.peso) / nullif(sum(c.peso), 0)
         from public.planilla_nota n
         join public.criterio c on c.id = n.criterio_id
        where n.planilla_id = v_id
     )
   where p.id = v_id;
  return null;
end;
$$;
create trigger planilla_nota_total after insert or update or delete on public.planilla_nota
  for each row execute function private.recalcular_total_planilla();

-- Resultado por ficha (lo calcula el servidor con el dominio: puntaje, banda, puesto).
create table public.resultado (
  ficha_id uuid primary key,
  evento_id uuid not null,
  academia_id uuid not null,
  puntaje numeric(8, 4) not null,
  banda text,
  grupo text not null,
  puesto integer not null check (puesto > 0),
  calculado_at timestamptz not null default now(),
  calculado_por uuid references auth.users (id) on delete set null,
  foreign key (ficha_id, evento_id, academia_id) references public.ficha (id, evento_id, academia_id) on delete cascade
);
create index resultado_evento_idx on public.resultado (evento_id, grupo, puesto);
create index resultado_academia_idx on public.resultado (academia_id);
create index resultado_ficha_fk_idx on public.resultado (ficha_id, evento_id, academia_id);
create index resultado_calculado_por_idx on public.resultado (calculado_por);
alter table public.resultado enable row level security;

create table public.premio (
  id uuid primary key default gen_random_uuid(),
  temporada_id uuid not null references public.temporada (id) on delete cascade,
  evento_id uuid references public.evento (id) on delete cascade,
  nombre jsonb not null check (private.es_traducible(nombre)),
  tipo text not null check (tipo in ('PRINCIPAL', 'ESPECIAL')),
  monto_centavos bigint check (monto_centavos >= 0),
  moneda text references public.moneda (codigo),
  criterio text not null default 'MANUAL' check (criterio in ('MANUAL', 'RANKING')),
  regla_empate text not null default 'DIVIDIR_MONTO' check (regla_empate in ('DIVIDIR_MONTO', 'MONTO_COMPLETO_CADA_UNO')),
  filtro jsonb not null default '{}'::jsonb check (jsonb_typeof(filtro) = 'object'),
  orden smallint not null default 1,
  constraint premio_moneda check ((monto_centavos is null) = (moneda is null))
);
create index premio_temporada_idx on public.premio (temporada_id);
create index premio_evento_idx on public.premio (evento_id);
create index premio_moneda_idx on public.premio (moneda);
alter table public.premio enable row level security;

create table public.premio_asignacion (
  id uuid primary key default gen_random_uuid(),
  premio_id uuid not null references public.premio (id) on delete cascade,
  evento_id uuid not null,
  academia_id uuid not null,
  ficha_id uuid not null,
  monto_centavos bigint check (monto_centavos >= 0),
  nota text check (char_length(nota) <= 1000),
  asignado_por uuid references auth.users (id) on delete set null,
  asignado_at timestamptz not null default now(),
  unique (premio_id, ficha_id),
  foreign key (ficha_id, evento_id, academia_id) references public.ficha (id, evento_id, academia_id) on delete cascade
);
create index premio_asignacion_ficha_idx on public.premio_asignacion (ficha_id, evento_id, academia_id);
create index premio_asignacion_evento_idx on public.premio_asignacion (evento_id);
create index premio_asignacion_academia_idx on public.premio_asignacion (academia_id);
create index premio_asignacion_asignado_por_idx on public.premio_asignacion (asignado_por);
alter table public.premio_asignacion enable row level security;

create table public.pase (
  id uuid primary key default gen_random_uuid(),
  evento_origen_id uuid references public.evento (id) on delete set null,
  evento_destino_id uuid not null references public.evento (id) on delete restrict,
  academia_id uuid not null references public.academia (id) on delete restrict,
  coreografia_id uuid,
  motivo text not null check (char_length(btrim(motivo)) >= 3),
  beneficio jsonb check (beneficio is null or (jsonb_typeof(beneficio) = 'object' and beneficio ? 'tipo')),
  registrado_por uuid not null references auth.users (id) on delete restrict,
  registrado_at timestamptz not null default now(),
  anulado_at timestamptz,
  anulado_por uuid references auth.users (id) on delete set null,
  motivo_anulacion text,
  foreign key (coreografia_id, academia_id) references public.coreografia (id, academia_id) on delete restrict,
  constraint pase_eventos_distintos check (evento_origen_id is null or evento_origen_id <> evento_destino_id)
);
create index pase_origen_idx on public.pase (evento_origen_id);
create index pase_destino_idx on public.pase (evento_destino_id);
create index pase_academia_idx on public.pase (academia_id);
create index pase_coreografia_idx on public.pase (coreografia_id, academia_id);
create index pase_registrado_por_idx on public.pase (registrado_por);
create index pase_anulado_por_idx on public.pase (anulado_por);
alter table public.pase enable row level security;

create or replace function private.guardar_pase()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and private.es_usuario_final() then
    new.registrado_por := (select auth.uid());
    new.registrado_at := now();
    new.anulado_at := null;
  end if;
  if tg_op = 'UPDATE' then
    if (new.evento_origen_id, new.evento_destino_id, new.academia_id, new.coreografia_id, new.motivo, new.beneficio, new.registrado_por, new.registrado_at)
       is distinct from
       (old.evento_origen_id, old.evento_destino_id, old.academia_id, old.coreografia_id, old.motivo, old.beneficio, old.registrado_por, old.registrado_at) then
      raise exception 'PASE_INMUTABLE' using errcode = 'P0001', hint = 'Anular y registrar uno nuevo';
    end if;
    if new.anulado_at is not null and char_length(btrim(coalesce(new.motivo_anulacion, ''))) < 3 then
      raise exception 'MOTIVO_REQUERIDO' using errcode = 'P0001';
    end if;
    if private.es_usuario_final() and new.anulado_at is not null and old.anulado_at is null then
      new.anulado_por := (select auth.uid());
    end if;
  end if;
  return new;
end;
$$;
create trigger pase_guardas before insert or update on public.pase
  for each row execute function private.guardar_pase();

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
create policy criterio_lectura on public.criterio for select to authenticated
  using (evento_id in (select private.eventos_miembro()) or evento_id in (select private.eventos_resultados_publicados()));
create policy criterio_gestion on public.criterio for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check (evento_id in (select private.eventos_con_permiso('evento.configurar')));

-- Planilla: jurado propio; supervisión; academia tras la publicación (Art. 32).
create policy planilla_lectura on public.planilla for select to authenticated
  using (
    jurado_id = (select auth.uid())
    or evento_id in (select private.eventos_con_permiso('puntajes.supervisar'))
    or (
      estado = 'ENVIADA'
      and academia_id in (select private.academias_del_usuario())
      and evento_id in (select private.eventos_resultados_publicados())
    )
  );
create policy planilla_alta on public.planilla for insert to authenticated
  with check (
    jurado_id = (select auth.uid())
    and evento_id in (select private.eventos_con_permiso('puntajes.cargar'))
  );
create policy planilla_edicion on public.planilla for update to authenticated
  using (
    (jurado_id = (select auth.uid()) and evento_id in (select private.eventos_con_permiso('puntajes.cargar')))
    or evento_id in (select private.eventos_con_permiso('puntajes.supervisar'))
  )
  with check (
    (jurado_id = (select auth.uid()) and evento_id in (select private.eventos_con_permiso('puntajes.cargar')))
    or evento_id in (select private.eventos_con_permiso('puntajes.supervisar'))
  );

create policy planilla_nota_lectura on public.planilla_nota for select to authenticated
  using (planilla_id in (select p.id from public.planilla p));
create policy planilla_nota_escritura on public.planilla_nota for all to authenticated
  using (
    planilla_id in (
      select p.id from public.planilla p
       where p.jurado_id = (select auth.uid())
         and p.evento_id in (select private.eventos_con_permiso('puntajes.cargar'))
    )
  )
  with check (
    planilla_id in (
      select p.id from public.planilla p
       where p.jurado_id = (select auth.uid())
         and p.evento_id in (select private.eventos_con_permiso('puntajes.cargar'))
    )
  );

create policy resultado_lectura on public.resultado for select to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('puntajes.supervisar'))
    or evento_id in (select private.eventos_con_permiso('pases.registrar'))
    or (
      academia_id in (select private.academias_del_usuario())
      and evento_id in (select private.eventos_resultados_publicados())
    )
  );

create policy premio_lectura on public.premio for select to authenticated
  using (
    (select private.es_super_admin())
    or evento_id in (select private.eventos_miembro())
    or evento_id in (select e.id from public.evento e where e.publicado)
    or (evento_id is null and temporada_id in (select t.id from public.temporada t where t.publicada))
  );
create policy premio_admin on public.premio for all to authenticated
  using ((select private.es_super_admin()) or evento_id in (select private.eventos_con_permiso('evento.configurar')))
  with check ((select private.es_super_admin()) or evento_id in (select private.eventos_con_permiso('evento.configurar')));

create policy premio_asignacion_lectura on public.premio_asignacion for select to authenticated
  using (
    evento_id in (select private.eventos_con_permiso('premios.asignar'))
    or (
      academia_id in (select private.academias_del_usuario())
      and evento_id in (select private.eventos_resultados_publicados())
    )
  );
create policy premio_asignacion_gestion on public.premio_asignacion for all to authenticated
  using (evento_id in (select private.eventos_con_permiso('premios.asignar')))
  with check (evento_id in (select private.eventos_con_permiso('premios.asignar')));

-- Pases: los registra quien tiene pases.registrar en el evento de origen (o Super Admin);
-- los ve la academia y el organizador del destino.
create policy pase_lectura on public.pase for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_origen_id in (select private.eventos_con_permiso('pases.registrar'))
    or evento_destino_id in (select private.eventos_con_permiso('inscripciones.ver'))
  );
create policy pase_alta on public.pase for insert to authenticated
  with check (
    (select private.es_super_admin())
    or evento_origen_id in (select private.eventos_con_permiso('pases.registrar'))
  );
create policy pase_anulacion on public.pase for update to authenticated
  using ((select private.es_super_admin()) or evento_origen_id in (select private.eventos_con_permiso('pases.registrar')))
  with check ((select private.es_super_admin()) or evento_origen_id in (select private.eventos_con_permiso('pases.registrar')));

-- Tiempo real (ADR-0012): el director técnico ve llegar las planillas. Realtime
-- aplica la RLS de planilla_lectura a cada suscriptor.
alter publication supabase_realtime add table public.planilla;

-- Destinos posibles de un pase: eventos de la misma temporada que el origen.
-- Quien registra pases suele no ser miembro de la final (aún sin publicar), así
-- que se exponen solo id, slug, nombre, tipo y fecha, y solo con el permiso.
create or replace function public.eventos_destino_pase(p_origen uuid)
returns table (id uuid, slug text, nombre jsonb, tipo text, fecha_inicio date)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.slug, e.nombre, e.tipo, e.fecha_inicio
    from public.evento e
    join public.evento o on o.id = p_origen and o.temporada_id = e.temporada_id
   where e.id <> p_origen
     and e.estado <> 'ARCHIVADO'
     and private.tiene_permiso(p_origen, 'pases.registrar')
   order by e.fecha_inicio, e.slug
$$;
revoke execute on function public.eventos_destino_pase(uuid) from public, anon;
grant execute on function public.eventos_destino_pase(uuid) to authenticated;

-- Devolución del jurado anonimizada para la academia (ADR-0008).
create view public.v_devolucion_jurado with (security_invoker = true) as
select
  p.evento_id,
  p.ficha_id,
  p.academia_id,
  dense_rank() over (partition by p.evento_id order by p.jurado_id) as jurado_numero,
  p.total,
  p.comentario,
  coalesce(
    (select jsonb_object_agg(c.codigo, n.valor)
       from public.planilla_nota n join public.criterio c on c.id = n.criterio_id
      where n.planilla_id = p.id),
    '{}'::jsonb
  ) as notas
from public.planilla p
where p.estado = 'ENVIADA';
