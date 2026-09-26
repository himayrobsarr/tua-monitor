import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const source = await readFile(join(repositoryRoot, 'src', 'lib', 'dates.ts'), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const dates = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

test('datetime-local se interpreta siempre como hora Colombia', () => {
  assert.equal(
    dates.colombiaLocalDateTimeToIso('2026-09-26T08:30'),
    '2026-09-26T13:30:00.000Z',
  )
  assert.equal(
    dates.toColombiaDateTimeInput('2026-09-26T13:30:00.000Z'),
    '2026-09-26T08:30',
  )
})

test('la conversión rechaza fechas locales imposibles', () => {
  assert.equal(dates.colombiaLocalDateTimeToIso('2026-02-30T08:30'), null)
  assert.equal(dates.colombiaLocalDateTimeToIso('texto'), null)
})

test('las fechas puras conservan el día sin depender de la zona horaria', () => {
  const formatted = dates.formatDateOnly('2026-09-26')
  assert.match(formatted, /^26\b/)
})
