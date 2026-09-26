begin;

-- Avoid waiting indefinitely for DDL locks while the application is active.
set local lock_timeout = '5s';

-- Keep the policy layer authoritative even if an environment drifted.
alter table public.trip_controls enable row level security;

-- This migration depends on the permissive INSERT policy installed by the
-- roles migration. Fail atomically if the expected authorization baseline is
-- missing instead of silently deploying a partial rule.
do $migration$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'trip_controls'
      and policyname = 'TUA roles can report controls'
      and cmd = 'INSERT'
      and permissive = 'PERMISSIVE'
      and 'authenticated'::name = any(roles)
  ) then
    raise exception using
      errcode = 'TUA99',
      message = 'TUA_EXPECTED_INSERT_POLICY_NOT_FOUND';
  end if;
end;
$migration$;

create or replace function public.enforce_trip_control_reporting_rules()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  tua_role text;
  trip_status text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  tua_role := public.current_tua_role();

  if tua_role = 'reporter' then
    -- FOR SHARE conflicts with updates to the trip status. The insert is
    -- therefore ordered either before finalization (allowed) or after it
    -- (rejected), including requests submitted from a stale browser tab.
    select t.status
      into trip_status
      from public.trips as t
     where t.id = new.trip_id
       for share of t;

    if not found then
      raise exception using
        errcode = 'TUA02',
        message = 'TUA_TRIP_NOT_FOUND',
        detail = 'No existe el viaje asociado al control.';
    end if;

    if trip_status is distinct from 'EN_ROUTE' then
      raise exception using
        errcode = 'TUA01',
        message = 'TUA_TRIP_NOT_EN_ROUTE',
        detail = 'Solo un administrador puede registrar controles cuando el viaje no está en ruta.';
    end if;

    -- A reporter cannot choose the official report time.
    new.reported_at := pg_catalog.clock_timestamp();
  end if;

  return new;
end;
$function$;

drop trigger if exists enforce_trip_control_reporting_rules
  on public.trip_controls;
create trigger enforce_trip_control_reporting_rules
before insert on public.trip_controls
for each row
execute function public.enforce_trip_control_reporting_rules();

-- Trigger functions are not API endpoints.
revoke all on function public.enforce_trip_control_reporting_rules()
  from public, anon, authenticated;

-- Restrictive policies are combined with every permissive INSERT policy, so
-- another permissive policy cannot accidentally reopen finalized trips.
drop policy if exists tua_control_insert_state_guard_v1
  on public.trip_controls;
create policy tua_control_insert_state_guard_v1
on public.trip_controls
as restrictive
for insert
to authenticated
with check (
  reported_by = (select auth.uid())
  and exists (
    select 1
    from public.trips as t
    where t.id = trip_controls.trip_id
      and (
        (select public.current_tua_role()) = 'admin'
        or (
          (select public.current_tua_role()) = 'reporter'
          and t.status = 'EN_ROUTE'
        )
      )
  )
);

comment on policy tua_control_insert_state_guard_v1
  on public.trip_controls
  is 'Reporter solo inserta controles en viajes EN_ROUTE; admin en cualquier estado.';

commit;
