import 'server-only'

type ErrorWithCode = { code?: string | null }

type ServerErrorEvent =
  | 'auth_lookup_failed'
  | 'role_lookup_failed'
  | 'trip_controls_query_failed'
  | 'trip_events_query_failed'
  | 'trip_history_query_failed'
  | 'trip_list_query_failed'
  | 'trip_query_failed'

type ServerOperation =
  | 'count_en_route_trips'
  | 'count_finished_trips'
  | 'get_authenticated_user'
  | 'select_current_user_role'
  | 'select_en_route_trips'
  | 'select_finished_trips'
  | 'select_trip'
  | 'select_trip_controls'
  | 'select_trip_events'

export function logServerError(
  event: ServerErrorEvent,
  operation: ServerOperation,
  error: ErrorWithCode,
) {
  console.error(JSON.stringify({
    level: 'error',
    event,
    code: error.code ?? 'UNKNOWN',
    operation,
  }))
}
