-- =============================================================================
-- SOED · 0400 · Liquidaciones, turnos de caja y cobros (ADR-0009, ADR-0010)
-- El pago nunca limita la participación: ninguna tabla de inscripción, orden,
-- puntaje ni acreditación referencia estas tablas.
-- =============================================================================

create table public.liquidacion (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  inscripcion_id uuid not null unique,
  correlativo integer not null check (correlativo > 0),
  numero text not null unique check (numero ~ '^LIQ-[A-Z0-9]{2,16}-[0-9]{4,}$'),
  creado_at timestamptz not null default now(),
  unique (evento_id, correlativo),
  unique (id, evento_id, academia_id),
  foreign key (inscripcion_id, evento_id, academia_id)
    references public.inscripcion (id, evento_id, academia_id) on delete restrict
);
create index liquidacion_evento_idx on public.liquidacion (evento_id);
create index liquidacion_academia_idx on public.liquidacion (academia_id);
create index liquidacion_inscripcion_fk_idx on public.liquidacion (inscripcion_id, evento_id, academia_id);
alter table public.liquidacion enable row level security;

create table public.liquidacion_version (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null,
  evento_id uuid not null,
  academia_id uuid not null,
  version integer not null check (version > 0),
  total_centavos bigint not null check (total_centavos >= 0),
  moneda text not null references public.moneda (codigo),
  detalle jsonb not null check (jsonb_typeof(detalle) = 'object'),
  idioma text not null default 'es' references public.idioma (codigo),
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  pdf_path text,
  emitida_por uuid references auth.users (id) on delete set null,
  emitida_at timestamptz not null default now(),
  unique (liquidacion_id, version),
  foreign key (liquidacion_id, evento_id, academia_id)
    references public.liquidacion (id, evento_id, academia_id) on delete restrict
);
create index liquidacion_version_fk_idx on public.liquidacion_version (liquidacion_id, evento_id, academia_id);
create index liquidacion_version_evento_idx on public.liquidacion_version (evento_id);
create index liquidacion_version_academia_idx on public.liquidacion_version (academia_id);
create index liquidacion_version_moneda_idx on public.liquidacion_version (moneda);
create index liquidacion_version_idioma_idx on public.liquidacion_version (idioma);
create index liquidacion_version_emitida_por_idx on public.liquidacion_version (emitida_por);
alter table public.liquidacion_version enable row level security;

create table public.turno_caja (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.evento (id) on delete restrict,
  usuario_id uuid not null references auth.users (id) on delete restrict,
  abierto_at timestamptz not null default now(),
  cerrado_at timestamptz,
  cerrado_por uuid references auth.users (id) on delete set null,
  resumen jsonb check (resumen is null or jsonb_typeof(resumen) = 'object')
);
create index turno_caja_evento_idx on public.turno_caja (evento_id);
create index turno_caja_usuario_idx on public.turno_caja (usuario_id);
create index turno_caja_cerrado_por_idx on public.turno_caja (cerrado_por);
create unique index turno_caja_abierto_unq on public.turno_caja (evento_id, usuario_id) where cerrado_at is null;
alter table public.turno_caja enable row level security;

create table public.cobro (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null,
  academia_id uuid not null,
  liquidacion_id uuid not null,
  monto_centavos bigint not null check (monto_centavos > 0),
  moneda text not null references public.moneda (codigo),
  medio text not null check (medio ~ '^[A-Z_]{2,30}$'),
  referencia text check (char_length(referencia) <= 200),
  nota text check (char_length(nota) <= 1000),
  client_uuid uuid not null unique,
  turno_caja_id uuid references public.turno_caja (id) on delete restrict,
  registrado_por uuid not null references auth.users (id) on delete restrict,
  registrado_at timestamptz not null default now(),
  dispositivo_at timestamptz,
  anulado_at timestamptz,
  anulado_por uuid references auth.users (id) on delete set null,
  motivo_anulacion text check (char_length(btrim(motivo_anulacion)) >= 3),
  foreign key (liquidacion_id, evento_id, academia_id)
    references public.liquidacion (id, evento_id, academia_id) on delete restrict,
  constraint cobro_anulacion_completa check (
    (anulado_at is null and anulado_por is null and motivo_anulacion is null)
    or (anulado_at is not null and motivo_anulacion is not null)
  )
);
create index cobro_liquidacion_idx on public.cobro (liquidacion_id, evento_id, academia_id);
create index cobro_evento_idx on public.cobro (evento_id, registrado_at);
create index cobro_academia_idx on public.cobro (academia_id);
create index cobro_moneda_idx on public.cobro (moneda);
create index cobro_turno_idx on public.cobro (turno_caja_id);
create index cobro_registrado_por_idx on public.cobro (registrado_por);
create index cobro_anulado_por_idx on public.cobro (anulado_por);
alter table public.cobro enable row level security;

-- Guardas del cobro: moneda y medio del evento, autor real, append-only.
create or replace function private.guardar_cobro()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.evento%rowtype;
begin
  if tg_op = 'DELETE' then
    raise exception 'COBRO_NO_SE_BORRA' using errcode = 'P0001', hint = 'Anular con motivo';
  end if;

  if tg_op = 'INSERT' then
    select * into v_evento from public.evento where id = new.evento_id;
    if new.moneda <> v_evento.moneda then
      raise exception 'MONEDA_DISTINTA' using errcode = 'P0001';
    end if;
    if not (new.medio = any (v_evento.medios_cobro)) then
      raise exception 'MEDIO_NO_HABILITADO' using errcode = 'P0001';
    end if;
    if private.es_usuario_final() then
      new.registrado_por := (select auth.uid());
      new.registrado_at := now();
      new.anulado_at := null;
      new.anulado_por := null;
      new.motivo_anulacion := null;
    end if;
    return new;
  end if;

  -- UPDATE: solo la anulación, una vez, con permiso.
  if (new.evento_id, new.academia_id, new.liquidacion_id, new.monto_centavos, new.moneda, new.medio,
      new.referencia, new.nota, new.client_uuid, new.turno_caja_id, new.registrado_por, new.registrado_at, new.dispositivo_at)
     is distinct from
     (old.evento_id, old.academia_id, old.liquidacion_id, old.monto_centavos, old.moneda, old.medio,
      old.referencia, old.nota, old.client_uuid, old.turno_caja_id, old.registrado_por, old.registrado_at, old.dispositivo_at) then
    raise exception 'COBRO_INMUTABLE' using errcode = 'P0001', hint = 'Anular y registrar uno nuevo';
  end if;
  if old.anulado_at is not null then
    raise exception 'COBRO_YA_ANULADO' using errcode = 'P0001';
  end if;
  if private.es_usuario_final() then
    new.anulado_at := now();
    new.anulado_por := (select auth.uid());
  end if;
  return new;
end;
$$;

create trigger cobro_guardas before insert or update or delete on public.cobro
  for each row execute function private.guardar_cobro();

-- La versión de liquidación es inmutable (historial).
create or replace function private.liquidacion_version_inmutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'LIQUIDACION_VERSION_INMUTABLE' using errcode = 'P0001';
  end if;
  if (new.liquidacion_id, new.version, new.total_centavos, new.moneda, new.detalle, new.qr_token, new.emitida_at)
     is distinct from
     (old.liquidacion_id, old.version, old.total_centavos, old.moneda, old.detalle, old.qr_token, old.emitida_at) then
    raise exception 'LIQUIDACION_VERSION_INMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger liquidacion_version_guardas before update or delete on public.liquidacion_version
  for each row execute function private.liquidacion_version_inmutable();

-- Alta de liquidación con número correlativo sin huecos (TR-15). Solo servidor.
create or replace function public.crear_liquidacion(p_inscripcion uuid)
returns public.liquidacion
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_insc public.inscripcion%rowtype;
  v_slug text;
  v_liq public.liquidacion%rowtype;
  v_n integer;
begin
  select * into v_liq from public.liquidacion where inscripcion_id = p_inscripcion;
  if found then
    return v_liq;
  end if;
  select * into v_insc from public.inscripcion where id = p_inscripcion;
  if not found then
    raise exception 'INSCRIPCION_INEXISTENTE' using errcode = 'P0002';
  end if;
  select slug into v_slug from public.evento where id = v_insc.evento_id;
  v_n := private.siguiente_numero(v_insc.evento_id, 'LIQUIDACION');
  insert into public.liquidacion (evento_id, academia_id, inscripcion_id, correlativo, numero)
  values (v_insc.evento_id, v_insc.academia_id, v_insc.id, v_n,
          'LIQ-' || v_slug || '-' || lpad(v_n::text, 4, '0'))
  returning * into v_liq;
  return v_liq;
end;
$$;
revoke execute on function public.crear_liquidacion(uuid) from public, anon, authenticated;
grant execute on function public.crear_liquidacion(uuid) to service_role;

-- Estado derivado de la liquidación (TR-19), con RLS del invocante.
create view public.v_liquidacion_estado with (security_invoker = true) as
select
  l.id as liquidacion_id,
  l.evento_id,
  l.academia_id,
  l.inscripcion_id,
  l.numero,
  v.version,
  v.total_centavos,
  v.moneda,
  v.qr_token,
  v.emitida_at,
  coalesce(c.cobrado, 0)::bigint as cobrado_centavos,
  (coalesce(v.total_centavos, 0) - coalesce(c.cobrado, 0))::bigint as saldo_centavos,
  case
    when coalesce(v.total_centavos, 0) <= 0 then 'SIN_CARGO'
    when coalesce(c.cobrado, 0) <= 0 then 'PENDIENTE'
    when c.cobrado < v.total_centavos then 'PARCIAL'
    else 'PAGADA'
  end as estado,
  c.primer_pago_at
from public.liquidacion l
left join lateral (
  select lv.version, lv.total_centavos, lv.moneda, lv.qr_token, lv.emitida_at
    from public.liquidacion_version lv
   where lv.liquidacion_id = l.id
   order by lv.version desc
   limit 1
) v on true
left join lateral (
  select sum(co.monto_centavos) as cobrado, min(co.registrado_at) as primer_pago_at
    from public.cobro co
   where co.liquidacion_id = l.id and co.anulado_at is null
) c on true;

-- Resumen de cobranza por evento (OR-27, SA-10).
create view public.v_resumen_cobranza with (security_invoker = true) as
select
  evento_id,
  moneda,
  count(*) as liquidaciones,
  sum(total_centavos)::bigint as esperado_centavos,
  sum(cobrado_centavos)::bigint as cobrado_centavos,
  sum(greatest(saldo_centavos, 0))::bigint as pendiente_centavos,
  count(*) filter (where estado = 'PAGADA') as pagadas,
  count(*) filter (where estado = 'PARCIAL') as parciales,
  count(*) filter (where estado = 'PENDIENTE') as pendientes,
  count(*) filter (where estado = 'SIN_CARGO') as sin_cargo
from public.v_liquidacion_estado
where version is not null
group by evento_id, moneda;

-- -----------------------------------------------------------------------------
-- Políticas
-- -----------------------------------------------------------------------------
create policy liquidacion_lectura on public.liquidacion for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('liquidaciones.ver'))
  );

create policy liquidacion_version_lectura on public.liquidacion_version for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('liquidaciones.ver'))
  );

create policy turno_caja_lectura on public.turno_caja for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or evento_id in (select private.eventos_con_permiso('caja.cerrar'))
  );
create policy turno_caja_apertura on public.turno_caja for insert to authenticated
  with check (
    usuario_id = (select auth.uid())
    and evento_id in (select private.eventos_con_permiso('cobros.registrar'))
  );
create policy turno_caja_cierre on public.turno_caja for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('caja.cerrar')))
  with check (evento_id in (select private.eventos_con_permiso('caja.cerrar')));

create policy cobro_lectura on public.cobro for select to authenticated
  using (
    academia_id in (select private.academias_del_usuario())
    or evento_id in (select private.eventos_con_permiso('liquidaciones.ver'))
  );
create policy cobro_alta on public.cobro for insert to authenticated
  with check (evento_id in (select private.eventos_con_permiso('cobros.registrar')));
create policy cobro_anulacion on public.cobro for update to authenticated
  using (evento_id in (select private.eventos_con_permiso('cobros.anular')))
  with check (evento_id in (select private.eventos_con_permiso('cobros.anular')));
-- Sin política de DELETE: append-only (además del trigger).
