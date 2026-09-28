import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const datesPath = join(repositoryRoot, 'src', 'lib', 'dates.ts')
const summaryPath = join(repositoryRoot, 'src', 'lib', 'trip-event-changes.ts')
const detailPagePath = join(repositoryRoot, 'src', 'app', 'viajes', '[id]', 'page.tsx')

function compile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}

const datesSource = await readFile(datesPath, 'utf8')
const datesUrl = `data:text/javascript;base64,${Buffer.from(compile(datesSource)).toString('base64')}`
const summarySource = await readFile(summaryPath, 'utf8')
const compiledSummary = compile(summarySource).replace(
  /from ['"]@\/lib\/dates['"]/,
  `from '${datesUrl}'`,
)
const summary = await import(`data:text/javascript;base64,${Buffer.from(compiledSummary).toString('base64')}`)

test('resume la creación del viaje con etiquetas y formatos en español', () => {
  const changes = summary.summarizeTripEventChanges('TRIP_CREATED', null, {
    created_at: '2026-09-26T13:30:00.000Z',
    destination: null,
    driver: 'Ana Pérez',
    id: 'trip-id',
    loading_date: '2026-09-26',
    plate: 'ABC123',
    status: 'EN_ROUTE',
    updated_at: '2026-09-26T13:30:00.000Z',
  })

  assert.deepEqual(changes.map(({ key, label }) => ({ key, label })), [
    { key: 'status', label: 'Estado' },
    { key: 'plate', label: 'Placa' },
    { key: 'driver', label: 'Conductor' },
    { key: 'loading_date', label: 'Fecha de cargue' },
  ])
  assert.equal(changes[0].after, 'En ruta')
  assert.equal(changes[0].before, undefined)
  assert.match(changes[3].after, /^26\b/)
  assert.ok(!changes.some(({ key }) => ['created_at', 'id', 'updated_at'].includes(key)))
})

test('muestra solo campos operativos modificados y representa valores vacíos', () => {
  const changes = summary.summarizeTripEventChanges(
    'TRIP_FINISHED',
    {
      driver: 'Ana Pérez',
      finished_at: null,
      plate: 'ABC123',
      status: 'EN_ROUTE',
      updated_at: '2026-09-26T13:30:00.000Z',
    },
    {
      driver: 'Ana Pérez',
      finished_at: '2026-09-26T13:30:00.000Z',
      plate: 'ABC123',
      status: 'FINISHED',
      updated_at: '2026-09-26T13:31:00.000Z',
    },
  )

  assert.deepEqual(changes.map(({ key }) => key), ['status', 'finished_at'])
  assert.deepEqual(changes[0], {
    after: 'Finalizado',
    before: 'En ruta',
    key: 'status',
    label: 'Estado',
  })
  assert.equal(changes[1].before, 'Sin registrar')
  assert.match(changes[1].after, /26.*8:30/i)
})

test('formatea controles y mantiene textos largos concisos', () => {
  const changes = summary.summarizeTripEventChanges(
    'CONTROL_UPDATED',
    {
      control_type: 'STOP',
      observation: null,
      reported_at: '2026-09-26T13:30:00.000Z',
    },
    {
      control_type: 'FINAL_ARRIVAL',
      observation: `  ${'detalle '.repeat(30)}  `,
      reported_at: '2026-09-26T14:45:00.000Z',
    },
  )

  assert.deepEqual(changes.map(({ label }) => label), [
    'Tipo de control',
    'Fecha y hora reportada',
    'Observación',
  ])
  assert.equal(changes[0].before, 'Parada')
  assert.equal(changes[0].after, 'Llegada final')
  assert.match(changes[1].before, /26.*8:30/i)
  assert.match(changes[1].after, /26.*9:45/i)
  assert.equal(changes[2].before, 'Sin registrar')
  assert.ok(changes[2].after.endsWith('…'))
  assert.ok(changes[2].after.length <= 160)
  assert.ok(changes[2].afterFull.length > 160)
})

test('conserva el valor completo cuando el cambio queda fuera del resumen', () => {
  const commonPrefix = 'a'.repeat(200)
  const [change] = summary.summarizeTripEventChanges(
    'TRIP_UPDATED',
    { observations: `${commonPrefix} antes` },
    { observations: `${commonPrefix} ahora` },
  )

  assert.equal(change.before, change.after)
  assert.notEqual(change.beforeFull, change.afterFull)
  assert.match(change.beforeFull, /antes$/)
  assert.match(change.afterFull, /ahora$/)
})

test('tolera estados ausentes o mal formados sin romper la bitácora', () => {
  assert.deepEqual(summary.summarizeTripEventChanges('TRIP_UPDATED', null, null), [])
  assert.deepEqual(summary.summarizeTripEventChanges('CONTROL_UPDATED', {}, []), [])
})

test('la página consulta ambos estados y expone un resumen accesible', async () => {
  const detailPageSource = await readFile(detailPagePath, 'utf8')

  assert.match(
    detailPageSource,
    /select\(['"]id, event_type, actor_id, actor_role, occurred_at, reason, before_state, after_state['"]\)/,
  )
  assert.match(detailPageSource, /summarizeTripEventChanges\(event\.event_type, event\.before_state, event\.after_state\)/)
  assert.match(detailPageSource, /<dl aria-label="Resumen de cambios"/)
  assert.match(detailPageSource, /label="Antes"/)
  assert.match(detailPageSource, /label="Ahora"/)
  assert.match(detailPageSource, /label="Registrado"/)
  assert.match(detailPageSource, /valueFull=\{change\.afterFull\}/)
})
