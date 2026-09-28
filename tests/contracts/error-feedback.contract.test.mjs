import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const inlineErrorComponents = [
  'download-excel-button.tsx',
  'edit-trip-form.tsx',
  'finish-trip-button.tsx',
  'login-form.tsx',
  'logout-button.tsx',
  'new-trip-control-form.tsx',
  'new-trip-form.tsx',
  'reopen-trip-button.tsx',
  'trip-control-card.tsx',
]

test('los errores inline no se anuncian también como toast', async () => {
  for (const file of inlineErrorComponents) {
    const source = await readFile(join(repositoryRoot, 'src', 'components', file), 'utf8')
    assert.match(source, /errorMessage/)
    assert.doesNotMatch(source, /notifyError/)
  }
})
