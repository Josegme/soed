-- =============================================================================
-- SOED · 0800 · Audit log, storage privado, API pública acotada y privilegios
-- ADR-0008, ADR-0011, ADR-0013
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit log append-only (ADR-0011)
-- -----------------------------------------------------------------------------
create table public.auditoria (
  id bigint generated always as identity primary key,
  ocurrido_at timestamptz not null default now(),
  usuario_id uuid,
  rol_sesion text,
  evento_id uuid,
  tabla text not null,
  registro_id text,
  accion text not null check (accion in ('INSERT', 'UPDATE', 'DELETE')),
  antes jsonb,
  despues jsonb
);
create index auditoria_evento_idx on public.auditoria (evento_id, ocurrido_at desc);
create index auditoria_tabla_idx on public.auditoria (tabla, ocurrido_at desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id);
alter table public.auditoria enable row level security;

-- Columnas con datos personales que nunca se copian al log (TR-33).
create or replace function private.columnas_excluidas_auditoria()
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array['documento_numero', 'documento_tipo', 'fecha_nacimiento', 'actualizado_at']
$$;

create or replace function private.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_despues jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_excluir text[] := private.columnas_excluidas_auditoria();
  v_clave text;
  v_cambios_antes jsonb := '{}'::jsonb;
  v_cambios_despues jsonb := '{}'::jsonb;
  v_fila jsonb := coalesce(v_despues, v_antes);
begin
  if tg_op = 'UPDATE' then
    for v_clave in select jsonb_object_keys(v_despues) loop
      if not (v_clave = any (v_excluir)) and (v_antes -> v_clave) is distinct from (v_despues -> v_clave) then
        v_cambios_antes := v_cambios_antes || jsonb_build_object(v_clave, v_antes -> v_clave);
        v_cambios_despues := v_cambios_despues || jsonb_build_object(v_clave, v_despues -> v_clave);
      end if;
    end loop;
    if v_cambios_despues = '{}'::jsonb then
      return null;
    end if;
  else
    v_cambios_antes := case when v_antes is not null then v_antes - v_excluir end;
    v_cambios_despues := case when v_despues is not null then v_despues - v_excluir end;
  end if;

  insert into public.auditoria (usuario_id, rol_sesion, evento_id, tabla, registro_id, accion, antes, despues)
  values (
    (select auth.uid()),
    coalesce(auth.role(), current_user),
    case
      when tg_table_name = 'evento' then (v_fila ->> 'id')::uuid
      when tg_table_name = 'pase' then coalesce((v_fila ->> 'evento_origen_id')::uuid, (v_fila ->> 'evento_destino_id')::uuid)
      when v_fila ? 'evento_id' then (v_fila ->> 'evento_id')::uuid
    end,
    tg_table_name,
    coalesce(v_fila ->> 'id', v_fila ->> 'ficha_id', v_fila ->> 'usuario_id'),
    tg_op,
    nullif(v_cambios_antes, '{}'::jsonb),
    nullif(v_cambios_despues, '{}'::jsonb)
  );
  return null;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'rol_global', 'evento_miembro', 'evento', 'ficha', 'ajuste_liquidacion', 'liquidacion_version',
    'cobro', 'turno_caja', 'planilla', 'resultado', 'pase', 'premio_asignacion', 'orden_item',
    'solicitud_modificacion', 'credencial'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function private.auditar()',
      'auditar_' || t, t
    );
  end loop;
end $$;

create policy auditoria_lectura on public.auditoria for select to authenticated
  using ((select private.es_super_admin()) or evento_id in (select private.eventos_con_permiso('auditoria.ver')));
-- Sin políticas de escritura: solo el trigger inserta.

-- -----------------------------------------------------------------------------
-- Storage (buckets privados + URLs firmadas)
-- musica:      <academia_id>/<coreografia_id>/<archivo>
-- documentos:  <evento_id>/<academia_id|staff>/<archivo>  (los escribe el servidor)
-- publico:     <evento_id>/<archivo>  (banners e imágenes del evento)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('musica', 'musica', false, 52428800, array['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac']),
  ('documentos', 'documentos', false, 20971520, array['application/pdf', 'text/csv', 'application/zip']),
  ('publico', 'publico', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create or replace function private.uuid_seguro(valor text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return valor::uuid;
exception when others then
  return null;
end;
$$;

-- Coreografías cuya música puede descargar el usuario (DJ u organizador del evento).
create or replace function private.coreografias_musica_descargable()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select f.coreografia_id from public.ficha f
   where f.evento_id in (select private.eventos_con_permiso('musica.descargar'))
$$;

grant execute on function
  private.uuid_seguro(text),
  private.coreografias_musica_descargable()
to authenticated, service_role;

create policy musica_lectura on storage.objects for select to authenticated
  using (
    bucket_id = 'musica'
    and (
      private.uuid_seguro((storage.foldername(name))[1]) in (select private.academias_del_usuario())
      or private.uuid_seguro((storage.foldername(name))[2]) in (select private.coreografias_musica_descargable())
    )
  );
create policy musica_subida on storage.objects for insert to authenticated
  with check (
    bucket_id = 'musica'
    and private.uuid_seguro((storage.foldername(name))[1]) in (select private.academias_del_usuario())
  );
create policy musica_reemplazo on storage.objects for update to authenticated
  using (bucket_id = 'musica' and private.uuid_seguro((storage.foldername(name))[1]) in (select private.academias_del_usuario()))
  with check (bucket_id = 'musica' and private.uuid_seguro((storage.foldername(name))[1]) in (select private.academias_del_usuario()));
create policy musica_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'musica' and private.uuid_seguro((storage.foldername(name))[1]) in (select private.academias_del_usuario()));

create policy documentos_lectura on storage.objects for select to authenticated
  using (
    bucket_id = 'documentos'
    and (
      private.uuid_seguro((storage.foldername(name))[1]) in (select private.eventos_con_permiso('liquidaciones.ver'))
      or private.uuid_seguro((storage.foldername(name))[2]) in (select private.academias_del_usuario())
    )
  );

create policy publico_escritura on storage.objects for insert to authenticated
  with check (
    bucket_id = 'publico'
    and private.uuid_seguro((storage.foldername(name))[1]) in (select private.eventos_con_permiso('evento.configurar'))
  );

-- -----------------------------------------------------------------------------
-- API pública acotada (anon): sin datos personales de bailarines (ADR-0008)
-- -----------------------------------------------------------------------------
create or replace function public.publico_orden(p_slug text)
returns table (
  pista jsonb,
  bloque jsonb,
  inicio_programado timestamptz,
  posicion integer,
  estado text,
  coreografia text,
  academia text,
  ciudad text,
  categoria text,
  formacion text,
  genero text
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre, b.nombre, b.inicio_programado, oi.posicion, oi.estado,
         f.nombre, a.nombre, a.ciudad, f.categoria, f.formacion, f.genero
    from public.evento e
    join public.orden_item oi on oi.evento_id = e.id
    join public.bloque b on b.id = oi.bloque_id
    join public.pista p on p.id = oi.pista_id
    join public.ficha f on f.id = oi.ficha_id
    join public.academia a on a.id = f.academia_id
   where e.slug = upper(p_slug)
     and e.publicado
     and e.orden_publicado_at is not null and e.orden_publicado_at <= now()
   order by p.orden, b.orden, oi.posicion
$$;

create or replace function public.publico_resultados(p_slug text)
returns table (
  grupo text,
  puesto integer,
  puntaje numeric,
  banda text,
  coreografia text,
  academia text,
  ciudad text,
  categoria text,
  formacion text,
  genero text
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.grupo, r.puesto, round(r.puntaje, 2), r.banda,
         f.nombre, a.nombre, a.ciudad, f.categoria, f.formacion, f.genero
    from public.evento e
    join public.resultado r on r.evento_id = e.id
    join public.ficha f on f.id = r.ficha_id
    join public.academia a on a.id = f.academia_id
   where e.slug = upper(p_slug)
     and e.publicado
     and e.resultados_publicados_at is not null and e.resultados_publicados_at <= now()
   order by r.grupo, r.puesto, f.nombre
$$;

-- Cronograma (PU-06): pistas y bloques con su horario. Se publica junto con el
-- evento porque no revela qué coreografías bailan en cada bloque.
create or replace function public.publico_cronograma(p_slug text)
returns table (
  pista jsonb,
  bloque jsonb,
  inicio_programado timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.nombre, b.nombre, b.inicio_programado
    from public.evento e
    join public.pista p on p.evento_id = e.id
    join public.bloque b on b.pista_id = p.id
   where e.slug = upper(p_slug)
     and e.publicado
     and b.inicio_programado is not null
   order by b.inicio_programado, p.orden, b.orden
$$;

revoke execute on function public.publico_orden(text), public.publico_resultados(text), public.publico_cronograma(text) from public;
grant execute on function public.publico_orden(text), public.publico_resultados(text), public.publico_cronograma(text)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Privilegios: anon no ve tablas salvo columnas públicas explícitas
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant select on public.idioma, public.moneda to anon;
grant select (id, temporada_id, slug, tipo, estado, nombre, idioma_defecto, moneda, zona_horaria, sede,
              fecha_inicio, fecha_fin, inscripcion_apertura, inscripcion_cierre, modificaciones_cierre,
              bases, reglamento, publicado, orden_publicado_at, resultados_publicados_at)
  on public.evento to anon;
grant select (id, anio, nombre, publicada) on public.temporada to anon;

-- Las funciones de la API pública y de negocio no quedan expuestas a anon por defecto.
alter default privileges in schema public revoke execute on functions from anon;
revoke execute on function public.reordenar_orden(uuid, uuid, integer) from anon;

-- Defensa en profundidad: RLS no aplica a TRUNCATE y las tablas append-only no
-- admiten UPDATE/DELETE desde la API aunque falte una política.
revoke truncate on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke truncate on tables from anon, authenticated;
revoke insert, update, delete on public.auditoria from authenticated;
revoke delete on public.cobro, public.liquidacion_version, public.pase, public.acreditacion_registro from authenticated;
revoke insert, update, delete on public.liquidacion, public.liquidacion_version, public.resultado, public.email_envio from authenticated;
