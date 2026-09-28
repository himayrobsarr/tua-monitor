begin;

-- Fail quickly instead of waiting behind application traffic. Each validation
-- still gets enough time to scan the existing rows once the lock is acquired.
set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.trips
  validate constraint trips_status_v2_check;

alter table public.trips
  validate constraint trips_status_finished_at_v2_check;

alter table public.trip_controls
  validate constraint trip_controls_control_type_v2_check;

alter table public.trip_events
  validate constraint trip_events_reason_whitespace_v2_check;

commit;
