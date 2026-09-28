'use server'

import { revalidatePath } from 'next/cache'

import { logServerError, logTripRpcError, type TripRpcOperation } from '@/lib/server-logging'
import { createClient } from '@/lib/supabase/server'
import type {
  CreateTripControlInput,
  ReopenTripInput,
  TripActionResult,
  TripVersionInput,
  UpdateTripControlInput,
  UpdateTripDetailsInput,
} from '@/types/actions'
import type { AppRole, Json } from '@/types/database'

type ServerClient = Awaited<ReturnType<typeof createClient>>
type RpcError = { code?: string | null }

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const reasonLimit = 2000

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value))
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function requiredText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value: unknown) {
  const normalized = requiredText(value)
  return normalized || null
}

function validReason(value: unknown) {
  return value === null || (typeof value === 'string' && value.trim().length <= reasonLimit)
}

function hasRpcId(value: Json): value is { [key: string]: Json | undefined } & { id: string } {
  return value !== null
    && !Array.isArray(value)
    && typeof value === 'object'
    && typeof value.id === 'string'
}

function validation(message: string, field?: 'reason'): TripActionResult {
  return { ok: false, code: 'VALIDATION', field, message }
}

function mapRpcError(error: RpcError, fallback: string, operation: TripRpcOperation): TripActionResult {
  logTripRpcError(operation, error)

  switch (error.code) {
    case 'TUA01':
      return {
        ok: false,
        code: 'INVALID_STATE',
        message: 'Este viaje ya no está en ruta. Solo un administrador puede agregar controles.',
        refresh: true,
      }
    case 'TUA10':
    case 'TUA18':
    case '42501':
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Tu usuario no tiene permisos para realizar esta acción.',
        refresh: true,
      }
    case 'TUA11':
    case 'TUA17':
      return {
        ok: false,
        code: 'NOT_FOUND',
        message: 'El registro ya no existe o no está disponible.',
        refresh: true,
      }
    case 'TUA12':
      return {
        ok: false,
        code: 'INVALID_STATE',
        message: 'El viaje ya no está en ruta. Actualiza la página para ver su estado actual.',
        refresh: true,
      }
    case 'TUA13':
      return {
        ok: false,
        code: 'INVALID_STATE',
        message: 'El viaje ya fue reabierto. Actualiza la página para ver su estado actual.',
        refresh: true,
      }
    case 'TUA14':
      return {
        ok: false,
        code: 'REASON_REQUIRED',
        field: 'reason',
        message: 'Escribe un motivo de hasta 2000 caracteres para dejar constancia del cambio.',
        refresh: true,
      }
    case 'TUA15':
      return {
        ok: false,
        code: 'CONFLICT',
        message: 'Otro administrador modificó este registro. Recarga la página y revisa los cambios antes de intentarlo de nuevo.',
      }
    case 'TUA16':
    case 'TUA30':
    case '22007':
    case '22P02':
      return validation('Revisa los datos ingresados e inténtalo de nuevo.')
    default:
      return { ok: false, code: 'UNKNOWN', message: fallback }
  }
}

async function authorize(allowedRoles: AppRole[]): Promise<
  | { ok: true; role: AppRole; supabase: ServerClient }
  | { ok: false; result: TripActionResult }
> {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError) {
    logServerError('auth_lookup_failed', 'get_authenticated_user', authError)
  }

  if (authError || !authData.user) {
    return {
      ok: false,
      result: {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Tu sesión terminó. Inicia sesión de nuevo para continuar.',
        refresh: true,
      },
    }
  }

  const { data: roleData, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (roleError) {
    logServerError('role_lookup_failed', 'select_current_user_role', roleError)

    return {
      ok: false,
      result: {
        ok: false,
        code: 'UNKNOWN',
        message: 'No fue posible verificar tus permisos. Inténtalo de nuevo.',
      },
    }
  }

  const role = roleData?.role
  if (!role || !allowedRoles.includes(role)) {
    return {
      ok: false,
      result: {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Tu usuario no tiene permisos para realizar esta acción.',
        refresh: true,
      },
    }
  }

  return { ok: true, role, supabase }
}

function revalidateTrip(tripId: string) {
  revalidatePath('/viajes')
  revalidatePath('/historial')
  revalidatePath(`/viajes/${tripId}`)
}

export async function finishTripAction(input: TripVersionInput): Promise<TripActionResult> {
  if (!isUuid(input?.tripId) || !isTimestamp(input?.expectedUpdatedAt)) {
    return validation('No fue posible identificar la versión actual del viaje. Actualiza la página.')
  }

  const authorization = await authorize(['admin'])
  if (!authorization.ok) return authorization.result

  const { data, error } = await authorization.supabase.rpc('finish_trip', {
    p_expected_updated_at: input.expectedUpdatedAt,
    p_trip_id: input.tripId,
  })

  if (error) return mapRpcError(error, 'No fue posible finalizar el viaje. Inténtalo de nuevo.', 'finish_trip')
  if (!hasRpcId(data)) return { ok: false, code: 'UNKNOWN', message: 'El servicio devolvió una respuesta inesperada.' }

  revalidateTrip(input.tripId)
  return { ok: true, message: 'Viaje finalizado correctamente.' }
}

export async function reopenTripAction(input: ReopenTripInput): Promise<TripActionResult> {
  const reason = requiredText(input?.reason)
  if (!isUuid(input?.tripId) || !isTimestamp(input?.expectedUpdatedAt)) {
    return validation('No fue posible identificar la versión actual del viaje. Actualiza la página.')
  }
  if (!reason || reason.length > reasonLimit) {
    return validation('Escribe un motivo de hasta 2000 caracteres para reabrir el viaje.', 'reason')
  }

  const authorization = await authorize(['admin'])
  if (!authorization.ok) return authorization.result

  const { data, error } = await authorization.supabase.rpc('reopen_trip', {
    p_expected_updated_at: input.expectedUpdatedAt,
    p_reason: reason,
    p_trip_id: input.tripId,
  })

  if (error) return mapRpcError(error, 'No fue posible reabrir el viaje. Inténtalo de nuevo.', 'reopen_trip')
  if (!hasRpcId(data)) return { ok: false, code: 'UNKNOWN', message: 'El servicio devolvió una respuesta inesperada.' }

  revalidateTrip(input.tripId)
  return { ok: true, message: 'Viaje reabierto correctamente.' }
}

export async function updateTripDetailsAction(input: UpdateTripDetailsInput): Promise<TripActionResult> {
  const plate = requiredText(input?.plate).toUpperCase()
  const driver = requiredText(input?.driver)
  const reason = optionalText(input?.reason)

  if (!isUuid(input?.tripId) || !isTimestamp(input?.expectedUpdatedAt)) {
    return validation('No fue posible identificar la versión actual del viaje. Actualiza la página.')
  }
  if (!plate || !driver || !isDateOnly(input?.loadingDate)) {
    return validation('Completa los campos obligatorios: placa, conductor y fecha de cargue.')
  }
  if (!validReason(input?.reason)) {
    return validation('El motivo no puede superar los 2000 caracteres.', 'reason')
  }

  const authorization = await authorize(['admin'])
  if (!authorization.ok) return authorization.result

  const { data, error } = await authorization.supabase.rpc('update_trip_details', {
    p_destination: optionalText(input.destination),
    p_driver: driver,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_loading_date: input.loadingDate,
    p_observations: optionalText(input.observations),
    p_plate: plate,
    p_product: optionalText(input.product),
    p_reason: reason,
    p_trip_id: input.tripId,
    p_warehouse: optionalText(input.warehouse),
  })

  if (error) return mapRpcError(error, 'No fue posible actualizar el viaje. Inténtalo de nuevo.', 'update_trip_details')
  if (!hasRpcId(data)) return { ok: false, code: 'UNKNOWN', message: 'El servicio devolvió una respuesta inesperada.' }

  revalidateTrip(input.tripId)
  return { ok: true, message: 'Viaje actualizado correctamente.' }
}

export async function createTripControlAction(input: CreateTripControlInput): Promise<TripActionResult> {
  const reportedLocation = requiredText(input?.reportedLocation)
  const reason = optionalText(input?.reason)

  if (!isUuid(input?.tripId)) return validation('No fue posible identificar el viaje. Actualiza la página.')
  if (input?.controlType !== 'STOP' && input?.controlType !== 'FINAL_ARRIVAL') {
    return validation('Selecciona un tipo de control válido.')
  }
  if (!reportedLocation) return validation('Ingresa la ubicación reportada.')
  if (input.reportedAt !== null && !isTimestamp(input.reportedAt)) {
    return validation('Ingresa una fecha y hora válidas para el control.')
  }
  if (!validReason(input.reason)) {
    return validation('El motivo no puede superar los 2000 caracteres.', 'reason')
  }

  const authorization = await authorize(['admin', 'reporter'])
  if (!authorization.ok) return authorization.result

  const { data, error } = await authorization.supabase.rpc('create_trip_control', {
    p_control_type: input.controlType,
    p_incident: optionalText(input.incident),
    p_observation: optionalText(input.observation),
    p_reason: reason,
    p_reported_at: authorization.role === 'admin' ? input.reportedAt : null,
    p_reported_location: reportedLocation,
    p_trip_id: input.tripId,
  })

  if (error) {
    return mapRpcError(
      error,
      `No fue posible registrar ${input.controlType === 'STOP' ? 'la parada' : 'la llegada final'}. Inténtalo de nuevo.`,
      'create_trip_control',
    )
  }
  if (!hasRpcId(data)) return { ok: false, code: 'UNKNOWN', message: 'El servicio devolvió una respuesta inesperada.' }

  revalidateTrip(input.tripId)
  return {
    ok: true,
    message: input.controlType === 'STOP' ? 'Parada registrada correctamente.' : 'Llegada final registrada correctamente.',
  }
}

export async function updateTripControlAction(input: UpdateTripControlInput): Promise<TripActionResult> {
  const reportedLocation = requiredText(input?.reportedLocation)
  const reason = optionalText(input?.reason)

  if (!isUuid(input?.controlId) || !isTimestamp(input?.expectedUpdatedAt)) {
    return validation('No fue posible identificar la versión actual del control. Actualiza la página.')
  }
  if (input?.controlType !== 'STOP' && input?.controlType !== 'FINAL_ARRIVAL') {
    return validation('Selecciona el tipo actual del control antes de guardar.')
  }
  if (!reportedLocation || !isTimestamp(input?.reportedAt)) {
    return validation('Completa la ubicación y la fecha/hora del control.')
  }
  if (!validReason(input.reason)) {
    return validation('El motivo no puede superar los 2000 caracteres.', 'reason')
  }

  const authorization = await authorize(['admin'])
  if (!authorization.ok) return authorization.result

  const { data, error } = await authorization.supabase.rpc('update_trip_control', {
    p_control_id: input.controlId,
    p_control_type: input.controlType,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_incident: optionalText(input.incident),
    p_observation: optionalText(input.observation),
    p_reason: reason,
    p_reported_at: input.reportedAt,
    p_reported_location: reportedLocation,
  })

  if (error) return mapRpcError(error, 'No fue posible actualizar el control. Inténtalo de nuevo.', 'update_trip_control')
  if (!hasRpcId(data) || !isUuid(data.trip_id)) {
    return { ok: false, code: 'UNKNOWN', message: 'El servicio devolvió una respuesta inesperada.' }
  }

  revalidateTrip(data.trip_id)
  return { ok: true, message: 'Control actualizado correctamente.' }
}
