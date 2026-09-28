import { formatColombiaDateTime, formatDateOnly } from '@/lib/dates'
import type { Json, TripEventType } from '@/types/database'

const emptyValueLabel = 'Sin registrar'
const maxTextLength = 160

type JsonObject = { [key: string]: Json | undefined }

type FieldDefinition = {
  key: string
  label: string
  format?: (value: Json | undefined) => string
}

export type TripEventChange = {
  after: string
  afterFull?: string
  before?: string
  beforeFull?: string
  key: string
  label: string
}

function compactText(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()

  if (!normalized) return emptyValueLabel
  if (normalized.length <= maxTextLength) return normalized

  return `${normalized.slice(0, maxTextLength - 1).trimEnd()}…`
}

function formatText(value: Json | undefined) {
  if (value === null || value === undefined) return emptyValueLabel
  if (typeof value === 'string') return compactText(value)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  const serialized = JSON.stringify(value)
  return serialized === undefined ? emptyValueLabel : compactText(serialized)
}

function fullText(value: Json | undefined) {
  if (typeof value !== 'string' && typeof value !== 'object') return undefined
  if (value === null) return undefined

  const serialized = typeof value === 'string' ? value : JSON.stringify(value)
  if (serialized === undefined) return undefined

  return compactText(serialized) === serialized ? undefined : serialized
}

function formatDate(value: Json | undefined) {
  if (typeof value !== 'string') return emptyValueLabel

  const formatted = formatDateOnly(value)
  return formatted === '—' ? emptyValueLabel : formatted
}

function formatDateTime(value: Json | undefined) {
  if (typeof value !== 'string') return emptyValueLabel

  const formatted = formatColombiaDateTime(value)
  return formatted === '—' ? emptyValueLabel : formatted
}

function formatStatus(value: Json | undefined) {
  if (value === 'EN_ROUTE') return 'En ruta'
  if (value === 'FINISHED') return 'Finalizado'
  return formatText(value)
}

function formatControlType(value: Json | undefined) {
  if (value === 'STOP') return 'Parada'
  if (value === 'FINAL_ARRIVAL') return 'Llegada final'
  return formatText(value)
}

const tripFields: readonly FieldDefinition[] = [
  { key: 'status', label: 'Estado', format: formatStatus },
  { key: 'plate', label: 'Placa' },
  { key: 'driver', label: 'Conductor' },
  { key: 'product', label: 'Producto' },
  { key: 'warehouse', label: 'Bodega' },
  { key: 'destination', label: 'Destino' },
  { key: 'loading_date', label: 'Fecha de cargue', format: formatDate },
  { key: 'observations', label: 'Observaciones' },
  { key: 'finished_at', label: 'Fecha de finalización', format: formatDateTime },
]

const controlFields: readonly FieldDefinition[] = [
  { key: 'control_type', label: 'Tipo de control', format: formatControlType },
  { key: 'reported_location', label: 'Ubicación reportada' },
  { key: 'reported_at', label: 'Fecha y hora reportada', format: formatDateTime },
  { key: 'incident', label: 'Novedad' },
  { key: 'observation', label: 'Observación' },
]

function isJsonObject(value: Json | null): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasRecordedValue(value: Json | undefined) {
  return value !== null
    && value !== undefined
    && (typeof value !== 'string' || value.trim().length > 0)
}

function sameJsonValue(before: Json | undefined, after: Json | undefined) {
  if (Object.is(before, after)) return true
  if (typeof before !== 'object' || typeof after !== 'object') return false

  return JSON.stringify(before) === JSON.stringify(after)
}

export function summarizeTripEventChanges(
  eventType: TripEventType,
  beforeState: Json | null,
  afterState: Json | null,
): TripEventChange[] {
  if (!isJsonObject(afterState)) return []

  const fields = eventType.startsWith('CONTROL_') ? controlFields : tripFields
  const isCreation = eventType === 'TRIP_CREATED' || eventType === 'CONTROL_CREATED'
  const before = isJsonObject(beforeState) ? beforeState : {}

  return fields.flatMap((field) => {
    const beforeValue = before[field.key]
    const afterValue = afterState[field.key]

    if (isCreation) {
      if (!hasRecordedValue(afterValue)) return []

      const afterFull = field.format ? undefined : fullText(afterValue)

      return [{
        after: (field.format ?? formatText)(afterValue),
        ...(afterFull ? { afterFull } : {}),
        key: field.key,
        label: field.label,
      }]
    }

    if (sameJsonValue(beforeValue, afterValue)) return []

    const beforeFull = field.format ? undefined : fullText(beforeValue)
    const afterFull = field.format ? undefined : fullText(afterValue)

    return [{
      after: (field.format ?? formatText)(afterValue),
      ...(afterFull ? { afterFull } : {}),
      before: (field.format ?? formatText)(beforeValue),
      ...(beforeFull ? { beforeFull } : {}),
      key: field.key,
      label: field.label,
    }]
  })
}
