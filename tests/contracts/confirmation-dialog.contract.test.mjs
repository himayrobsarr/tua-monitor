import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const dialogPath = join(repositoryRoot, 'src', 'components', 'confirmation-dialog.tsx')
const source = await readFile(dialogPath, 'utf8')

test('el diálogo de confirmación administra foco, fondo y pantallas bajas', () => {
  assert.match(source, /<dialog/)
  assert.match(source, /dialog\.showModal\(\)/)
  assert.match(source, /returnFocusRef\.current\?\.focus\(\)/)
  assert.match(source, /event\.key !== ['"]Tab['"]/)
  assert.match(source, /document\.body\.style\.overflow = ['"]hidden['"]/)
  assert.match(source, /max-h-\[calc\(100dvh-2rem\)\]/)
  assert.match(source, /overflow-y-auto/)
  assert.match(source, /aria-describedby=/)
})
