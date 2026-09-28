import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const packageJson = JSON.parse(await readFile(join(repositoryRoot, 'package.json'), 'utf8'))
const layoutSource = await readFile(join(repositoryRoot, 'src', 'app', 'layout.tsx'), 'utf8')
const observabilitySource = await readFile(
  join(repositoryRoot, 'src', 'components', 'vercel-observability.tsx'),
  'utf8',
)
const helperSource = await readFile(
  join(repositoryRoot, 'src', 'lib', 'observability.ts'),
  'utf8',
)
const compiledHelper = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const observability = await import(
  `data:text/javascript;base64,${Buffer.from(compiledHelper).toString('base64')}`
)

test('Vercel Analytics y Speed Insights redactan identificadores y consultas', () => {
  assert.ok(packageJson.dependencies['@vercel/analytics'])
  assert.ok(packageJson.dependencies['@vercel/speed-insights'])

  assert.match(layoutSource, /<VercelObservability\s*\/>/)
  assert.match(layoutSource, /referrer:\s*['"]strict-origin['"]/)
  assert.match(observabilitySource, /^['"]use client['"]/)
  assert.match(observabilitySource, /<Analytics\s+beforeSend=/)
  assert.match(observabilitySource, /<SpeedInsights\s+beforeSend=/)
  assert.doesNotMatch(observabilitySource, /\b(?:plate|placa|tripId|userId|email)\b/i)
})

test('la redacción elimina filtros, fragmentos e identificadores de viaje', () => {
  assert.equal(
    observability.redactAnalyticsUrl(
      'https://tua-monitor.vercel.app/viajes/425504fa-2adf-4959-8976-a5cadca1713c?plate=ABC123#control',
    ),
    'https://tua-monitor.vercel.app/viajes/[id]',
  )
  assert.equal(
    observability.redactAnalyticsPathname('/viajes/425504fa-2adf-4959-8976-a5cadca1713c/editar'),
    '/viajes/[id]/editar',
  )
  assert.equal(observability.redactAnalyticsPathname('/viajes/nuevo'), '/viajes/nuevo')
  assert.equal(observability.redactAnalyticsUrl('/ruta-relativa'), null)
})
