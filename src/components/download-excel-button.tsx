'use client'

import { Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'
import type { Database } from '@/types/database'

type ExportTrip = Pick<
  Database['public']['Tables']['trips']['Row'],
  'id' | 'plate' | 'driver' | 'product' | 'warehouse' | 'destination' | 'loading_date' | 'observations' | 'status'
>

type ExportControl = Pick<
  Database['public']['Tables']['trip_controls']['Row'],
  'trip_id' | 'control_type' | 'reported_location' | 'incident' | 'observation'
>

const pageSize = 1_000

function controlCellValue(control: ExportControl | undefined) {
  if (!control) return ''

  return [
    control.reported_location,
    control.incident ? `Novedad: ${control.incident}` : null,
    control.observation ? `Observación: ${control.observation}` : null,
  ].filter(Boolean).join('\n')
}

function downloadName(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `MONITOREO_TUA_${day}-${month}-${date.getFullYear()}.xlsx`
}

async function fetchTrips(supabase: SupabaseClient<Database>) {
  const trips: ExportTrip[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('trips')
      .select('id, plate, driver, product, warehouse, destination, loading_date, observations, status')
      .in('status', ['EN_ROUTE', 'FINISHED'])
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    trips.push(...data)
    if (data.length < pageSize) return trips
  }
}

async function fetchControls(supabase: SupabaseClient<Database>) {
  const controls: ExportControl[] = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('trip_controls')
      .select('trip_id, control_type, reported_location, incident, observation')
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1)

    if (error) throw error
    controls.push(...data)
    if (data.length < pageSize) return controls
  }
}

export function DownloadExcelButton() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleDownload() {
    setErrorMessage('')
    setIsGenerating(true)

    try {
      const supabase = createClient()
      const [trips, controls, ExcelJS] = await Promise.all([
        fetchTrips(supabase),
        fetchControls(supabase),
        import('exceljs'),
      ])
      const controlsByTripAndType = new Map(
        controls.map((control) => [`${control.trip_id}:${control.control_type}`, control]),
      )
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('MONITOREO')

      worksheet.columns = [
        { header: 'Nº', key: 'number', width: 7 },
        { header: 'PLACA', key: 'plate', width: 15 },
        { header: 'CONDUCTOR', key: 'driver', width: 24 },
        { header: 'PRODUCTO', key: 'product', width: 20 },
        { header: 'BODEGA', key: 'warehouse', width: 20 },
        { header: 'DESTINO', key: 'destination', width: 24 },
        { header: 'FECHA DE CARGUE', key: 'loadingDate', width: 19 },
        { header: 'MONITOREO HORA-3:PM', key: 'control1500', width: 30 },
        { header: 'MONITOREO HORA-08 PM', key: 'control2000', width: 30 },
        { header: 'MONITOREO HORA-5:AM', key: 'control0500', width: 30 },
        { header: 'OBSERVACIONES', key: 'observations', width: 32 },
        { header: 'ESTADO', key: 'status', width: 15 },
      ]

      trips.forEach((trip, index) => {
        worksheet.addRow({
          number: index + 1,
          plate: trip.plate,
          driver: trip.driver,
          product: trip.product ?? '',
          warehouse: trip.warehouse ?? '',
          destination: trip.destination ?? '',
          loadingDate: new Date(`${trip.loading_date}T00:00:00`),
          control1500: controlCellValue(controlsByTripAndType.get(`${trip.id}:15:00`)),
          control2000: controlCellValue(controlsByTripAndType.get(`${trip.id}:20:00`)),
          control0500: controlCellValue(controlsByTripAndType.get(`${trip.id}:05:00`)),
          observations: trip.observations ?? '',
          status: trip.status === 'FINISHED' ? 'FINALIZADO' : 'EN RUTA',
        })
      })

      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      headerRow.height = 28
      worksheet.autoFilter = { from: 'A1', to: 'L1' }
      worksheet.views = [{ state: 'frozen', ySplit: 1 }]
      worksheet.getColumn('G').numFmt = 'dd/mm/yyyy'

      for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber)
        row.alignment = { vertical: 'top' }
        row.height = 42
        ;['H', 'I', 'J', 'K'].forEach((column) => {
          row.getCell(column).alignment = { vertical: 'top', wrapText: true }
        })
      }

      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = downloadName(new Date())
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      notifySuccess('Archivo Excel descargado correctamente.')
    } catch {
      const message = 'No fue posible generar el archivo de Excel. Inténtalo de nuevo.'
      setErrorMessage(message)
      notifyError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleDownload} disabled={isGenerating} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
        {isGenerating ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Download className="size-4" aria-hidden="true" />}
        {isGenerating ? 'Generando...' : 'Descargar Excel'}
      </button>
      {errorMessage ? <p role="alert" className="absolute right-0 top-full z-10 mt-2 w-72 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">{errorMessage}</p> : null}
    </div>
  )
}
