'use client'

import { Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'
import type { Database } from '@/types/database'

type ExportTrip = Pick<Database['public']['Tables']['trips']['Row'], 'id' | 'plate' | 'driver' | 'product' | 'warehouse' | 'destination' | 'loading_date' | 'observations' | 'status'>
type ExportControl = Pick<Database['public']['Tables']['trip_controls']['Row'], 'trip_id' | 'control_type' | 'reported_location' | 'incident' | 'observation' | 'reported_at' | 'created_at' | 'updated_at'>

const pageSize = 1_000
const colombiaUtcOffset = '-05:00'

type DownloadExcelButtonProps = {
  finishedFrom?: string
  finishedTo?: string
}

function downloadName(date: Date) {
  return `MONITOREO_TUA_${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}.xlsx`
}

function controlTypeLabel(controlType: string | null) {
  return controlType === 'STOP' ? 'PARADA' : 'LLEGADA FINAL'
}

function colombiaDayStart(date: string, nextDay = false) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error('La fecha del período no es válida.')

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const boundary = new Date(Date.UTC(year, month - 1, day))

  if (boundary.getUTCFullYear() !== year || boundary.getUTCMonth() !== month - 1 || boundary.getUTCDate() !== day) {
    throw new Error('La fecha del período no es válida.')
  }

  if (nextDay) boundary.setUTCDate(boundary.getUTCDate() + 1)

  return `${boundary.getUTCFullYear()}-${String(boundary.getUTCMonth() + 1).padStart(2, '0')}-${String(boundary.getUTCDate()).padStart(2, '0')}T00:00:00${colombiaUtcOffset}`
}

async function fetchAll<T>(fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: Error | null }>) {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}

async function fetchControlsForTrips(supabase: SupabaseClient<Database>, tripIds: string[]) {
  const controls: ExportControl[] = []
  const tripIdChunkSize = 100

  for (let start = 0; start < tripIds.length; start += tripIdChunkSize) {
    const tripIdChunk = tripIds.slice(start, start + tripIdChunkSize)
    const chunkControls = await fetchAll<ExportControl>(async (from, to) => await supabase
      .from('trip_controls')
      .select('trip_id, control_type, reported_location, incident, observation, reported_at, created_at, updated_at')
      .in('trip_id', tripIdChunk)
      .order('reported_at')
      .range(from, to))

    controls.push(...chunkControls)
  }

  return controls
}

function formatSheet(worksheet: import('exceljs').Worksheet, dateColumns: string[]) {
  const header = worksheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  header.height = 28
  worksheet.views = [{ state: 'frozen', ySplit: 1 }]
  worksheet.autoFilter = { from: 'A1', to: worksheet.getRow(1).cellCount > 0 ? worksheet.getCell(1, worksheet.getRow(1).cellCount).address : 'A1' }
  dateColumns.forEach((column) => { worksheet.getColumn(column).numFmt = 'dd/mm/yyyy hh:mm' })
  for (let row = 2; row <= worksheet.rowCount; row += 1) {
    worksheet.getRow(row).alignment = { vertical: 'top', wrapText: true }
    worksheet.getRow(row).height = 36
  }
}

export function DownloadExcelButton({ finishedFrom, finishedTo }: DownloadExcelButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleDownload() {
    setErrorMessage('')
    setIsGenerating(true)
    try {
      const supabase = createClient()
      const hasFinishedPeriod = finishedFrom !== undefined || finishedTo !== undefined
      const finishedFromBoundary = finishedFrom?.trim() ? colombiaDayStart(finishedFrom.trim()) : undefined
      const finishedToBoundary = finishedTo?.trim() ? colombiaDayStart(finishedTo.trim(), true) : undefined
      if (finishedFrom?.trim() && finishedTo?.trim() && finishedFrom.trim() > finishedTo.trim()) throw new Error('El rango de fechas no es válido.')

      const [trips, ExcelJS] = await Promise.all([
        fetchAll<ExportTrip>(async (from, to) => {
          let query = supabase
            .from('trips')
            .select('id, plate, driver, product, warehouse, destination, loading_date, observations, status')
            .order('created_at')

          if (hasFinishedPeriod) {
            query = query.eq('status', 'FINISHED')
            if (finishedFromBoundary) query = query.gte('finished_at', finishedFromBoundary)
            if (finishedToBoundary) query = query.lt('finished_at', finishedToBoundary)
          } else {
            query = query.in('status', ['EN_ROUTE', 'FINISHED'])
          }

          return await query.range(from, to)
        }),
        import('exceljs'),
      ])
      const controls = await fetchControlsForTrips(supabase, trips.map((trip) => trip.id))
      const tripsById = new Map(trips.map((trip) => [trip.id, trip]))
      const workbook = new ExcelJS.Workbook()
      const summary = workbook.addWorksheet('MONITOREO')
      summary.columns = [{ header: 'Nº', key: 'number', width: 7 }, { header: 'PLACA', key: 'plate', width: 15 }, { header: 'CONDUCTOR', key: 'driver', width: 24 }, { header: 'PRODUCTO', key: 'product', width: 20 }, { header: 'BODEGA', key: 'warehouse', width: 20 }, { header: 'DESTINO', key: 'destination', width: 24 }, { header: 'FECHA DE CARGUE', key: 'loadingDate', width: 20 }, { header: 'CONTROLES REGISTRADOS', key: 'controls', width: 22 }, { header: 'OBSERVACIONES', key: 'observations', width: 32 }, { header: 'ESTADO', key: 'status', width: 15 }]
      const controlsByTrip = new Map<string, number>()
      controls.forEach((control) => controlsByTrip.set(control.trip_id, (controlsByTrip.get(control.trip_id) ?? 0) + 1))
      trips.forEach((trip, index) => summary.addRow({ number: index + 1, plate: trip.plate, driver: trip.driver, product: trip.product ?? '', warehouse: trip.warehouse ?? '', destination: trip.destination ?? '', loadingDate: new Date(`${trip.loading_date}T00:00:00`), controls: controlsByTrip.get(trip.id) ?? 0, observations: trip.observations ?? '', status: trip.status === 'FINISHED' ? 'FINALIZADO' : 'EN RUTA' }))
      formatSheet(summary, ['G'])
      const detail = workbook.addWorksheet('CONTROLES')
      detail.columns = [{ header: 'Nº', key: 'number', width: 7 }, { header: 'PLACA', key: 'plate', width: 15 }, { header: 'CONDUCTOR', key: 'driver', width: 24 }, { header: 'PRODUCTO', key: 'product', width: 20 }, { header: 'BODEGA', key: 'warehouse', width: 20 }, { header: 'DESTINO', key: 'destination', width: 24 }, { header: 'TIPO DE CONTROL', key: 'controlType', width: 20 }, { header: 'UBICACIÓN REPORTADA', key: 'location', width: 26 }, { header: 'FECHA Y HORA DEL CONTROL', key: 'reportedAt', width: 24 }, { header: 'NOVEDAD', key: 'incident', width: 26 }, { header: 'OBSERVACIÓN', key: 'observation', width: 34 }, { header: 'FECHA DE REGISTRO', key: 'createdAt', width: 24 }, { header: 'ÚLTIMA ACTUALIZACIÓN', key: 'updatedAt', width: 24 }]
      controls.forEach((control, index) => { const trip = tripsById.get(control.trip_id); if (trip) detail.addRow({ number: index + 1, plate: trip.plate, driver: trip.driver, product: trip.product ?? '', warehouse: trip.warehouse ?? '', destination: trip.destination ?? '', controlType: controlTypeLabel(control.control_type), location: control.reported_location ?? '', reportedAt: new Date(control.reported_at), incident: control.incident ?? '', observation: control.observation ?? '', createdAt: new Date(control.created_at), updatedAt: new Date(control.updated_at) }) })
      formatSheet(detail, ['I', 'L', 'M'])
      const buffer = await workbook.xlsx.writeBuffer()
      const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = downloadName(new Date())
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      notifySuccess('Archivo Excel descargado correctamente.')
    } catch (error) {
      const message = error instanceof Error && error.message === 'El rango de fechas no es válido.'
        ? error.message
        : 'No fue posible generar el archivo de Excel. Inténtalo de nuevo.'
      setErrorMessage(message)
      notifyError(message)
    } finally { setIsGenerating(false) }
  }

  return <div className="relative"><button type="button" onClick={handleDownload} disabled={isGenerating} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">{isGenerating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}{isGenerating ? 'Generando...' : 'Descargar Excel'}</button>{errorMessage ? <p role="alert" className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">{errorMessage}</p> : null}</div>
}
