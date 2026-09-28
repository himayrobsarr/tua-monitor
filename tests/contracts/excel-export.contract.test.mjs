import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const exportComponentPath = join(
  repositoryRoot,
  'src',
  'components',
  'download-excel-button.tsx',
)
const source = await readFile(exportComponentPath, 'utf8')
const sourceFile = ts.createSourceFile(
  exportComponentPath,
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
)

const labelFunction = sourceFile.statements.find(
  (statement) => ts.isFunctionDeclaration(statement)
    && statement.name?.text === 'controlTypeLabel',
)

assert.ok(labelFunction, 'No se encontró controlTypeLabel en la exportación Excel')

const compiled = ts.transpileModule(
  `${labelFunction.getText(sourceFile)}\nexport { controlTypeLabel }`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
const { controlTypeLabel } = await import(moduleUrl)

test('la exportación distingue tipos actuales y controles legados', () => {
  assert.equal(controlTypeLabel('STOP'), 'PARADA')
  assert.equal(controlTypeLabel('FINAL_ARRIVAL'), 'LLEGADA FINAL')
  assert.equal(controlTypeLabel('15:00'), 'CONTROL LEGADO (15:00)')
  assert.equal(controlTypeLabel('20:00'), 'CONTROL LEGADO (20:00)')
  assert.equal(controlTypeLabel('05:00'), 'CONTROL LEGADO (05:00)')
  assert.equal(controlTypeLabel(null), 'CONTROL LEGADO')
})
