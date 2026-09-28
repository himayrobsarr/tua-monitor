import 'server-only'

type ErrorWithCode = { code?: string | null }

export type TripRpcOperation =
  | 'create_trip_control'
  | 'finish_trip'
  | 'reopen_trip'
  | 'update_trip_control'
  | 'update_trip_details'

const expectedTripRpcCodes = new Set([
  'TUA01',
  'TUA10',
  'TUA11',
  'TUA12',
  'TUA13',
  'TUA14',
  'TUA15',
  'TUA16',
  'TUA17',
  'TUA18',
  'TUA30',
])

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

export function logTripRpcError(
  operation: TripRpcOperation,
  error: ErrorWithCode,
) {
  const code = error.code ?? 'UNKNOWN'

  if (expectedTripRpcCodes.has(code)) {
    console.log(JSON.stringify({
      level: 'warning',
      event: 'trip_rpc_rejected',
      code,
      operation,
    }))
    return
  }

  console.error(JSON.stringify({
    level: 'error',
    event: 'trip_rpc_failed',
    code,
    operation,
  }))
}
