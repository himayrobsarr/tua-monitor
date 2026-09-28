begin;

set local lock_timeout = '5s';

-- The UI trims all whitespace, but authenticated callers can invoke the RPCs
-- directly. Normalize and validate again at the append-only audit boundary so
-- a visually empty reason rolls the complete parent mutation back.
create or replace function public.enforce_trip_event_reason()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  whitespace_chars constant text := U&' \0009\000A\000B\000C\000D\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\200B\2028\2029\202F\205F\2060\3000\FEFF';
  normalized_reason text := nullif(
    pg_catalog.btrim(new.reason, whitespace_chars),
    ''
  );
begin
  if new.reason is not null and normalized_reason is null then
    raise exception using
      errcode = 'TUA14',
      message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  if normalized_reason is not null
     and pg_catalog.length(normalized_reason) > 2000 then
    raise exception using
      errcode = 'TUA14',
      message = 'TUA_CHANGE_REASON_REQUIRED';
  end if;

  new.reason := normalized_reason;
  return new;
end;
$function$;

drop trigger if exists enforce_trip_event_reason on public.trip_events;
create trigger enforce_trip_event_reason
before insert on public.trip_events
for each row execute function public.enforce_trip_event_reason();

revoke all on function public.enforce_trip_event_reason()
  from public, anon, authenticated;

-- Keep the invariant visible in the schema as well. NOT VALID avoids blocking
-- deployment on legacy events while protecting every new or changed row.
do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.trip_events'::regclass
      and conname = 'trip_events_reason_whitespace_v2_check'
  ) then
    alter table public.trip_events
      add constraint trip_events_reason_whitespace_v2_check
      check (
        reason is null
        or pg_catalog.length(
          pg_catalog.btrim(
            reason,
            U&' \0009\000A\000B\000C\000D\0085\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\200B\2028\2029\202F\205F\2060\3000\FEFF'
          )
        ) between 1 and 2000
      ) not valid;
  end if;
end;
$constraint$;

commit;
