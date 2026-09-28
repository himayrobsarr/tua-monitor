import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const sourceProxyPath = join(repositoryRoot, 'src', 'proxy.ts')
const misplacedProxyPath = join(repositoryRoot, 'proxy.ts')

test('el proxy de autenticación está al mismo nivel que src/app', async () => {
  await assert.rejects(
    access(misplacedProxyPath),
    (error) => error?.code === 'ENOENT',
    'proxy.ts en la raíz es ignorado cuando la aplicación vive en src/app',
  )

  const source = await readFile(sourceProxyPath, 'utf8')

  assert.match(source, /import \{ updateSession \} from ['"]@\/lib\/supabase\/middleware['"]/)
  assert.match(source, /export async function proxy\(request: NextRequest\)/)
  assert.match(source, /return updateSession\(request\)/)
  assert.match(source, /export const config\s*=\s*\{/)
  assert.match(source, /matcher:/)
})
