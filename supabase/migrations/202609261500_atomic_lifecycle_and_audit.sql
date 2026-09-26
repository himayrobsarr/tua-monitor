begin;

set local lock_timeout = '5s';

create table if not exists public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete restrict,
  control_id uuid references public.trip_controls (id) on delete restrict,
  actor_id uuid,
  actor_role text,
  occurred_at timestamptz not null default pg_catalog.clock_timestamp(),
  event_type text not null,
  before_state jsonb,
  after_state jsonb,
  reason text,
  constraint trip_events_event_type_check check (event_type in (
    'TRIP_CREATED',
    'TRIP_UPDATED',
    'TRIP_FINISHED',
    'TRIP_REOPENED',
    'CONTROL_CREATED',
    'CONTROL_UPDATED'
  )),
  constraint trip_events_reason_check check (
    reason is null
    or pg_catalog.length(pg_catalog.btrim(reason)) between 1 and 2000
  )
);

create index if not exists trip_events_trip_time_idx
  on public.trip_events (trip_id, occurred_at desc, id desc);
create index if not exists trip_events_control_time_idx
  on public.trip_events (control_id, occurred_at desc, id desc)
  where control_id is not null;

alter table public.trip_events enable row level security;
revoke all on table public.trip_events from public, anon, authenticated;
grant select on table public.trip_events to authenticated;

drop policy if exists tua_admin_read_trip_events_v1 on public.trip_events;
create policy tua_admin_read_trip_events_v1
on public.trip_events for select
to authenticated
using ((select public.current_tua_role()) = 'admin');

alter table public.trips enable row level security;

-- Even administrators must create trips in the initial EN_ROUTE state. The
-- FINISHED transition and its database timestamp only come from finish_trip.
drop policy if exists tua_trip_insert_state_guard_v1 on public.trips;
create policy tua_trip_insert_state_guard_v1
on public.trips
as restrictive
for insert
to authenticated
with check (
  (select public.current_tua_role()) = 'admin'
  and status::text = 'EN_ROUTE'
  and finished_at is null
);

create or replace function public.enforce_new_trip_state()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  database_time timestamptz := pg_catalog.clock_timestamp();
begin
  -- Keep maintenance/service-role imports possible while making every
  -- authenticated application insert use authoritative database values.
  if auth.uid() is not null then
    new.status := 'EN_ROUTE';
    new.finished_at := null;
    new.created_at := database_time;
    new.updated_at := database_time;
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_new_trip_state on public.trips;
create trigger enforce_new_trip_state
before insert on public.trips
for each row execute function public.enforce_new_trip_state();

revoke all on function public.enforce_new_trip_state()
  from public, anon, authenticated;

create or replace function public.reject_trip_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  raise exception using
    errcode = 'TUA20',
    message = 'TUA_TRIP_EVENTS_APPEND_ONLY';
end;
$function$;

drop trigger if exists reject_trip_event_update_delete on public.trip_events;
create trigger reject_trip_event_update_delete
before update or delete on public.trip_events
for each row execute function public.reject_trip_event_mutation();

drop trigger if exists reject_trip_event_truncate on public.trip_events;
create trigger reject_trip_event_truncate
before truncate on public.trip_events
for each statement execute function public.reject_trip_event_mutation();

revoke all on function public.reject_trip_event_mutation()
  from public, anon, authenticated;

create or replace function public.set_tua_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := pg_catalog.clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists set_trips_updated_at on public.trips;
create trigger set_trips_updated_at
before update on public.trips
for each row execute function public.set_tua_updated_at();

drop trigger if exists set_trip_controls_updated_at on public.trip_controls;
create trigger set_trip_controls_updated_at
before update on public.trip_controls
for each row execute function public.set_tua_updated_at();

revoke all on function public.set_tua_updated_at()
  from public, anon, authenticated;

-- Preserve historical scheduled control types, but only allow the current
-- STOP and FINAL_ARRIVAL values on new controls or when changing the type.
create or replace function public.enforce_current_trip_control_type()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'UPDATE'
     and new.control_type is not distinct from old.control_type then
    return new;
  end if;

  if new.control_type is null
     or new.control_type::text not in ('STOP', 'FINAL_ARRIVAL') then
    raise exception using
      errcode = 'TUA30',
      message = 'TUA_INVALID_CONTROL_TYPE';
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_current_trip_control_type
  on public.trip_controls;
create trigger enforce_current_trip_control_type
before insert or update of control_type on public.trip_controls
for each row execute function public.enforce_current_trip_control_type();

revoke all on function public.enforce_current_trip_control_type()
  from public, anon, authenticated;

-- These constraints protect future writes without rejecting legacy rows at
-- deployment time. Validate them after running the inventory queries in the
-- accompanying documentation.
do $constraints$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_status_v2_check'
  ) then
    execute 'alter table public.trips add constraint trips_status_v2_check check (status is not null and status::text in (''EN_ROUTE'', ''FINISHED'')) not valid';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.trips'::regclass
      and conname = 'trips_status_finished_at_v2_check'
  ) then
    execute 'alter table public.trips add constraint trips_status_finished_at_v2_check check ((status::text = ''EN_ROUTE'' and finished_at is null) or (status::text = ''FINISHED'' and finished_at is not null)) not valid';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.trip_controls'::regclass
      and conname = 'trip_controls_control_type_v2_check'
  ) then
    execute 'alter table public.trip_controls add constraint trip_controls_control_type_v2_check check (control_type is null or control_type::text in (''STOP'', ''FINAL_ARRIVAL'', ''15:00'', ''20:00'', ''05:00'')) not valid';
  end if;
end;
$constraints$;

create or replace function public.audit_trip_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  event_name text;
  audit_reason text := nullif(
    pg_catalog.btrim(pg_catalog.current_setting('tua.audit_reason', true)),
    ''
  );
begin
  if tg_op = 'INSERT' then
    event_name := 'TRIP_CREATED';
  elsif old.status::text = 'EN_ROUTE'
        and new.status::text = 'FINISHED' then
    event_name := 'TRIP_FINISHED';
  elsif old.status::text = 'FINISHED'
        and new.status::text = 'EN_ROUTE' then
    event_name := 'TRIP_REOPENED';
  else
    event_name := 'TRIP_UPDATED';
  end if;

  if event_name = 'TRIP_REOPENED'
     and audit_reason is null then
    raise exception using
      errcode = 'TUA14',
      message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  if event_name = 'TRIP_UPDATED'
     and old.status::text is distinct from 'EN_ROUTE'
     and audit_reason is null then
    raise exception using
      errcode = 'TUA14',
      message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  insert into public.trip_events (
    trip_id,
    actor_id,
    actor_role,
    event_type,
    before_state,
    after_state,
    reason
  ) values (
    new.id,
    auth.uid(),
    public.current_tua_role(),
    event_name,
    case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end,
    pg_catalog.to_jsonb(new),
    audit_reason
  );

  return new;
end;
$function$;

create or replace function public.audit_trip_control_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  audit_reason text := nullif(
    pg_catalog.btrim(pg_catalog.current_setting('tua.audit_reason', true)),
    ''
  );
  parent_status text;
begin
  select t.status::text
    into parent_status
    from public.trips as t
   where t.id = new.trip_id
     for share of t;

  if parent_status is distinct from 'EN_ROUTE'
     and audit_reason is null then
    raise exception using
      errcode = 'TUA14',
      message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  insert into public.trip_events (
    trip_id,
    control_id,
    actor_id,
    actor_role,
    event_type,
    before_state,
    after_state,
    reason
  ) values (
    new.trip_id,
    new.id,
    auth.uid(),
    public.current_tua_role(),
    case when tg_op = 'INSERT' then 'CONTROL_CREATED' else 'CONTROL_UPDATED' end,
    case when tg_op = 'INSERT' then null else pg_catalog.to_jsonb(old) end,
    pg_catalog.to_jsonb(new),
    audit_reason
  );

  return new;
end;
$function$;

drop trigger if exists audit_trip_change on public.trips;
create trigger audit_trip_change
after insert or update on public.trips
for each row execute function public.audit_trip_change();

drop trigger if exists audit_trip_control_change on public.trip_controls;
create trigger audit_trip_control_change
after insert or update on public.trip_controls
for each row execute function public.audit_trip_control_change();

revoke all on function public.audit_trip_change()
  from public, anon, authenticated;
revoke all on function public.audit_trip_control_change()
  from public, anon, authenticated;

create or replace function public.finish_trip(
  p_trip_id uuid,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  trip_before public.trips%rowtype;
  trip_after public.trips%rowtype;
begin
  if auth.uid() is null
     or public.current_tua_role() is distinct from 'admin' then
    raise exception using errcode = 'TUA10', message = 'TUA_ADMIN_REQUIRED';
  end if;

  select t.*
    into trip_before
    from public.trips as t
   where t.id = p_trip_id
     for update of t;

  if not found then
    raise exception using errcode = 'TUA11', message = 'TUA_TRIP_NOT_FOUND';
  end if;

  if trip_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'TUA15', message = 'TUA_TRIP_VERSION_CONFLICT';
  end if;

  if trip_before.status::text is distinct from 'EN_ROUTE' then
    raise exception using errcode = 'TUA12', message = 'TUA_TRIP_EXPECTED_EN_ROUTE';
  end if;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  update public.trips as t
     set status = 'FINISHED',
         finished_at = pg_catalog.clock_timestamp()
   where t.id = p_trip_id
   returning t.* into trip_after;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  return pg_catalog.jsonb_build_object(
    'id', trip_after.id,
    'status', trip_after.status,
    'finished_at', trip_after.finished_at,
    'updated_at', trip_after.updated_at
  );
end;
$function$;

create or replace function public.reopen_trip(
  p_trip_id uuid,
  p_expected_updated_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  trip_before public.trips%rowtype;
  trip_after public.trips%rowtype;
  change_reason text := nullif(pg_catalog.btrim(p_reason), '');
begin
  if auth.uid() is null
     or public.current_tua_role() is distinct from 'admin' then
    raise exception using errcode = 'TUA10', message = 'TUA_ADMIN_REQUIRED';
  end if;

  if change_reason is null
     or pg_catalog.length(change_reason) > 2000 then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  select t.*
    into trip_before
    from public.trips as t
   where t.id = p_trip_id
     for update of t;

  if not found then
    raise exception using errcode = 'TUA11', message = 'TUA_TRIP_NOT_FOUND';
  end if;

  if trip_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'TUA15', message = 'TUA_TRIP_VERSION_CONFLICT';
  end if;

  if trip_before.status::text is distinct from 'FINISHED' then
    raise exception using errcode = 'TUA13', message = 'TUA_TRIP_EXPECTED_FINISHED';
  end if;

  perform pg_catalog.set_config('tua.audit_reason', change_reason, true);

  update public.trips as t
     set status = 'EN_ROUTE',
         finished_at = null
   where t.id = p_trip_id
   returning t.* into trip_after;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  return pg_catalog.jsonb_build_object(
    'id', trip_after.id,
    'status', trip_after.status,
    'finished_at', trip_after.finished_at,
    'updated_at', trip_after.updated_at
  );
end;
$function$;

create or replace function public.update_trip_details(
  p_trip_id uuid,
  p_expected_updated_at timestamptz,
  p_plate text,
  p_driver text,
  p_product text,
  p_warehouse text,
  p_destination text,
  p_loading_date date,
  p_observations text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  trip_before public.trips%rowtype;
  trip_after public.trips%rowtype;
  change_reason text := nullif(pg_catalog.btrim(p_reason), '');
  normalized_plate text := pg_catalog.upper(pg_catalog.btrim(p_plate));
  normalized_driver text := pg_catalog.btrim(p_driver);
begin
  if auth.uid() is null
     or public.current_tua_role() is distinct from 'admin' then
    raise exception using errcode = 'TUA10', message = 'TUA_ADMIN_REQUIRED';
  end if;

  if normalized_plate is null
     or normalized_plate = ''
     or normalized_driver is null
     or normalized_driver = ''
     or p_loading_date is null then
    raise exception using errcode = 'TUA16', message = 'TUA_INVALID_TRIP_INPUT';
  end if;

  select t.*
    into trip_before
    from public.trips as t
   where t.id = p_trip_id
     for update of t;

  if not found then
    raise exception using errcode = 'TUA11', message = 'TUA_TRIP_NOT_FOUND';
  end if;

  if trip_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'TUA15', message = 'TUA_TRIP_VERSION_CONFLICT';
  end if;

  if change_reason is not null
     and pg_catalog.length(change_reason) > 2000 then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  if trip_before.status::text is distinct from 'EN_ROUTE'
     and change_reason is null then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  perform pg_catalog.set_config(
    'tua.audit_reason',
    coalesce(change_reason, ''),
    true
  );

  update public.trips as t
     set plate = normalized_plate,
         driver = normalized_driver,
         product = nullif(pg_catalog.btrim(p_product), ''),
         warehouse = nullif(pg_catalog.btrim(p_warehouse), ''),
         destination = nullif(pg_catalog.btrim(p_destination), ''),
         loading_date = p_loading_date,
         observations = nullif(pg_catalog.btrim(p_observations), '')
   where t.id = p_trip_id
   returning t.* into trip_after;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  return pg_catalog.jsonb_build_object(
    'id', trip_after.id,
    'updated_at', trip_after.updated_at
  );
end;
$function$;

create or replace function public.create_trip_control(
  p_trip_id uuid,
  p_control_type text,
  p_reported_location text,
  p_incident text,
  p_observation text,
  p_reported_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  tua_role text := public.current_tua_role();
  trip_status text;
  control_id uuid;
  report_time timestamptz;
  change_reason text := nullif(pg_catalog.btrim(p_reason), '');
  normalized_location text := pg_catalog.btrim(p_reported_location);
begin
  if auth.uid() is null
     or (
       tua_role is distinct from 'admin'
       and tua_role is distinct from 'reporter'
     ) then
    raise exception using errcode = 'TUA18', message = 'TUA_ROLE_REQUIRED';
  end if;

  if p_control_type is null
     or p_control_type not in ('STOP', 'FINAL_ARRIVAL') then
    raise exception using errcode = 'TUA30', message = 'TUA_INVALID_CONTROL_TYPE';
  end if;

  if normalized_location is null
     or normalized_location = '' then
    raise exception using errcode = 'TUA16', message = 'TUA_INVALID_CONTROL_INPUT';
  end if;

  select t.status::text
    into trip_status
    from public.trips as t
   where t.id = p_trip_id
     for share of t;

  if not found then
    raise exception using errcode = 'TUA11', message = 'TUA_TRIP_NOT_FOUND';
  end if;

  if tua_role = 'reporter'
     and trip_status is distinct from 'EN_ROUTE' then
    raise exception using errcode = 'TUA01', message = 'TUA_TRIP_NOT_EN_ROUTE';
  end if;

  if change_reason is not null
     and pg_catalog.length(change_reason) > 2000 then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  if tua_role = 'admin'
     and trip_status is distinct from 'EN_ROUTE'
     and change_reason is null then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  report_time := case
    when tua_role = 'reporter' then pg_catalog.clock_timestamp()
    else coalesce(p_reported_at, pg_catalog.clock_timestamp())
  end;

  perform pg_catalog.set_config(
    'tua.audit_reason',
    coalesce(change_reason, ''),
    true
  );

  insert into public.trip_controls (
    trip_id,
    control_type,
    reported_location,
    incident,
    observation,
    reported_at,
    reported_by
  ) values (
    p_trip_id,
    p_control_type,
    normalized_location,
    nullif(pg_catalog.btrim(p_incident), ''),
    nullif(pg_catalog.btrim(p_observation), ''),
    report_time,
    auth.uid()
  ) returning id into control_id;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  return pg_catalog.jsonb_build_object('id', control_id);
end;
$function$;

create or replace function public.update_trip_control(
  p_control_id uuid,
  p_expected_updated_at timestamptz,
  p_control_type text,
  p_reported_location text,
  p_incident text,
  p_observation text,
  p_reported_at timestamptz,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  control_before public.trip_controls%rowtype;
  control_after public.trip_controls%rowtype;
  trip_status text;
  change_reason text := nullif(pg_catalog.btrim(p_reason), '');
  normalized_location text := pg_catalog.btrim(p_reported_location);
begin
  if auth.uid() is null
     or public.current_tua_role() is distinct from 'admin' then
    raise exception using errcode = 'TUA10', message = 'TUA_ADMIN_REQUIRED';
  end if;

  if p_control_type is null
     or p_control_type not in ('STOP', 'FINAL_ARRIVAL') then
    raise exception using errcode = 'TUA30', message = 'TUA_INVALID_CONTROL_TYPE';
  end if;

  if normalized_location is null
     or normalized_location = ''
     or p_reported_at is null then
    raise exception using errcode = 'TUA16', message = 'TUA_INVALID_CONTROL_INPUT';
  end if;

  select c.*
    into control_before
    from public.trip_controls as c
   where c.id = p_control_id
     for update of c;

  if not found then
    raise exception using errcode = 'TUA17', message = 'TUA_CONTROL_NOT_FOUND';
  end if;

  if control_before.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = 'TUA15', message = 'TUA_CONTROL_VERSION_CONFLICT';
  end if;

  select t.status::text
    into trip_status
    from public.trips as t
   where t.id = control_before.trip_id
     for share of t;

  if not found then
    raise exception using errcode = 'TUA11', message = 'TUA_TRIP_NOT_FOUND';
  end if;

  if change_reason is not null
     and pg_catalog.length(change_reason) > 2000 then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  if trip_status is distinct from 'EN_ROUTE'
     and change_reason is null then
    raise exception using errcode = 'TUA14', message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  perform pg_catalog.set_config(
    'tua.audit_reason',
    coalesce(change_reason, ''),
    true
  );

  update public.trip_controls as c
     set control_type = p_control_type,
         reported_location = normalized_location,
         incident = nullif(pg_catalog.btrim(p_incident), ''),
         observation = nullif(pg_catalog.btrim(p_observation), ''),
         reported_at = p_reported_at
   where c.id = p_control_id
   returning c.* into control_after;

  perform pg_catalog.set_config('tua.audit_reason', '', true);

  return pg_catalog.jsonb_build_object(
    'id', control_after.id,
    'trip_id', control_after.trip_id,
    'updated_at', control_after.updated_at
  );
end;
$function$;

revoke all on function public.finish_trip(uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.reopen_trip(uuid, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.update_trip_details(
  uuid, timestamptz, text, text, text, text, text, date, text, text
) from public, anon, authenticated;
revoke all on function public.create_trip_control(
  uuid, text, text, text, text, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.update_trip_control(
  uuid, timestamptz, text, text, text, text, timestamptz, text
) from public, anon, authenticated;

grant execute on function public.finish_trip(uuid, timestamptz)
  to authenticated;
grant execute on function public.reopen_trip(uuid, timestamptz, text)
  to authenticated;
grant execute on function public.update_trip_details(
  uuid, timestamptz, text, text, text, text, text, date, text, text
) to authenticated;
grant execute on function public.create_trip_control(
  uuid, text, text, text, text, timestamptz, text
) to authenticated;
grant execute on function public.update_trip_control(
  uuid, timestamptz, text, text, text, text, timestamptz, text
) to authenticated;

-- Mutations now go through the audited RPCs. Read access and trip creation
-- retain their existing grants and RLS policies.
revoke update on table public.trips from authenticated;
revoke insert, update on table public.trip_controls from authenticated;

commit;
