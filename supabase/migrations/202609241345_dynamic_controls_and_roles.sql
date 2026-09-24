begin;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'reporter')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'public.trip_controls'::regclass
      and con.contype = 'u'
      and con.conkey::smallint[] = array[
        (select attnum from pg_attribute where attrelid = 'public.trip_controls'::regclass and attname = 'trip_id' and not attisdropped),
        (select attnum from pg_attribute where attrelid = 'public.trip_controls'::regclass and attname = 'control_type' and not attisdropped)
      ]::smallint[]
  loop
    execute format('alter table public.trip_controls drop constraint if exists %I', constraint_record.conname);
  end loop;
end;
$$;

alter table public.trip_controls
  drop constraint if exists trip_controls_control_type_check,
  alter column control_type drop not null,
  alter column reported_at set default now();

alter table public.trip_controls
  add column if not exists reported_by uuid references auth.users (id) on delete set null;

alter table public.trip_controls
  alter column reported_by set default auth.uid();

comment on column public.trip_controls.control_type is 'Campo legado de los controles por horario fijo. Los nuevos controles dinámicos lo dejan vacío.';

create or replace function public.current_tua_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.user_roles
  where user_id = auth.uid()
$$;

revoke all on function public.current_tua_role() from public;
grant execute on function public.current_tua_role() to authenticated;

create or replace function public.enforce_trip_control_reporting_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and public.current_tua_role() = 'reporter' then
    new.reported_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_trip_control_reporting_rules on public.trip_controls;
create trigger enforce_trip_control_reporting_rules
before insert on public.trip_controls
for each row execute function public.enforce_trip_control_reporting_rules();

alter table public.trips enable row level security;
alter table public.trip_controls enable row level security;
alter table public.user_roles enable row level security;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('trips', 'trip_controls', 'user_roles')
  loop
    execute format('drop policy if exists %I on public.%I', policy_record.policyname, policy_record.tablename);
  end loop;
end;
$$;

revoke all on table public.trips from anon, authenticated;
revoke all on table public.trip_controls from anon, authenticated;
revoke all on table public.user_roles from anon, authenticated;

grant select, insert, update on table public.trips to authenticated;
grant select, insert, update on table public.trip_controls to authenticated;
grant select on table public.user_roles to authenticated;

create policy "TUA roles can read trips"
on public.trips for select
to authenticated
using (public.current_tua_role() in ('admin', 'reporter'));

create policy "Admins can create trips"
on public.trips for insert
to authenticated
with check (public.current_tua_role() = 'admin');

create policy "Admins can update trips"
on public.trips for update
to authenticated
using (public.current_tua_role() = 'admin')
with check (public.current_tua_role() = 'admin');

create policy "TUA roles can read controls"
on public.trip_controls for select
to authenticated
using (public.current_tua_role() in ('admin', 'reporter'));

create policy "TUA roles can report controls"
on public.trip_controls for insert
to authenticated
with check (
  public.current_tua_role() in ('admin', 'reporter')
  and reported_by = auth.uid()
);

create policy "Admins can update controls"
on public.trip_controls for update
to authenticated
using (public.current_tua_role() = 'admin')
with check (public.current_tua_role() = 'admin');

create policy "Users can read their own role"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

commit;
