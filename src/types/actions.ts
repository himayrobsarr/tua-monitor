import type { ControlType } from '@/types/database'

export type TripActionErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'CONFLICT'
  | 'REASON_REQUIRED'
  | 'UNKNOWN'

export type TripActionResult =
  | { ok: true; message: string }
  | {
      ok: false
      code: TripActionErrorCode
      field?: 'reason'
      message: string
      refresh?: boolean
    }

export type TripVersionInput = {
  expectedUpdatedAt: string
  tripId: string
}

export type ReopenTripInput = TripVersionInput & {
  reason: string
}

export type UpdateTripDetailsInput = TripVersionInput & {
  destination: string | null
  driver: string
  loadingDate: string
  observations: string | null
  plate: string
  product: string | null
  reason: string | null
  warehouse: string | null
}

export type CreateTripControlInput = {
  controlType: ControlType
  incident: string | null
  observation: string | null
  reason: string | null
  reportedAt: string | null
  reportedLocation: string
  tripId: string
}

export type UpdateTripControlInput = {
  controlId: string
  controlType: ControlType
  expectedUpdatedAt: string
  incident: string | null
  observation: string | null
  reason: string | null
  reportedAt: string
  reportedLocation: string
}
