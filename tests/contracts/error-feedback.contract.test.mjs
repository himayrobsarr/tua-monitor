import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const inlineOnlyComponents = [
  'download-excel-button.tsx',
  'login-form.tsx',
  'logout-button.tsx',
  'new-trip-form.tsx',
]
const refreshAwareComponents = [
  'edit-trip-form.tsx',
  'finish-trip-button.tsx',
  'new-trip-control-form.tsx',
  'reopen-trip-button.tsx',
  'trip-control-card.tsx',
]

test('los errores que no refrescan se anuncian solo inline', async () => {
  for (const file of inlineOnlyComponents) {
    const source = await readFile(join(repositoryRoot, 'src', 'components', file), 'utf8')
    assert.match(source, /errorMessage/)
    assert.doesNotMatch(source, /notifyError/)
  }
})

test('los componentes con fallos que refrescan delegan el feedback al helper', async () => {
  for (const file of refreshAwareComponents) {
    const source = await readFile(join(repositoryRoot, 'src', 'components', file), 'utf8')
    assert.match(source, /errorMessage/)
    assert.match(source, /handleTripActionFailure\(result/)
    assert.doesNotMatch(source, /notifyError/)
  }
})

test('el helper usa toast antes de refrescar y conserva el error inline en los demás casos', async () => {
  const source = await readFile(join(repositoryRoot, 'src', 'lib', 'action-feedback.ts'), 'utf8')
  const refreshBranch = source.match(/if \(result\.refresh\) \{([\s\S]*?)\n  \}/)?.[1] ?? ''

  assert.match(refreshBranch, /notifyError\(result\.message\)/)
  assert.match(refreshBranch, /refresh\(\)/)
  assert.match(refreshBranch, /return/)
  assert.match(source, /setInlineError\(result\.message\)/)
})
