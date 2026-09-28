import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

async function source(...segments) {
  return readFile(join(repositoryRoot, ...segments), 'utf8')
}

const [logger, roles, actions, trips, history, tripDetail] = await Promise.all([
  source('src', 'lib', 'server-logging.ts'),
  source('src', 'lib', 'roles.ts'),
  source('src', 'app', 'viajes', 'actions.ts'),
  source('src', 'app', 'viajes', 'page.tsx'),
  source('src', 'app', 'historial', 'page.tsx'),
  source('src', 'app', 'viajes', '[id]', 'page.tsx'),
])

test('los fallos críticos se registran sin contexto sensible', () => {
  assert.match(logger, /import ['"]server-only['"]/)
  assert.match(logger, /console\.error\(JSON\.stringify\(\{/)
  assert.match(logger, /code:\s*error\.code\s*\?\?\s*['"]UNKNOWN['"]/)
  assert.doesNotMatch(logger, /error\.(?:message|details|hint|stack)/)

  assert.match(roles, /logServerError\(['"]auth_lookup_failed['"],\s*['"]get_authenticated_user['"]/)
  assert.match(roles, /logServerError\(['"]role_lookup_failed['"],\s*['"]select_current_user_role['"]/)
  assert.match(actions, /logServerError\(['"]auth_lookup_failed['"],\s*['"]get_authenticated_user['"]/)
  assert.match(actions, /logServerError\(['"]role_lookup_failed['"],\s*['"]select_current_user_role['"]/)

  assert.match(trips, /logServerError\(['"]trip_list_query_failed['"],\s*['"]select_en_route_trips['"]/)
  assert.match(trips, /logServerError\(['"]trip_list_query_failed['"],\s*['"]count_en_route_trips['"]/)
  assert.match(history, /logServerError\(['"]trip_history_query_failed['"],\s*['"]select_finished_trips['"]/)
  assert.match(history, /logServerError\(['"]trip_history_query_failed['"],\s*['"]count_finished_trips['"]/)
  assert.match(logger, /['"]trip_controls_query_failed['"]/)
  assert.match(logger, /['"]select_trip_controls['"]/)
  assert.match(tripDetail, /logServerError\(['"]trip_controls_query_failed['"],\s*['"]select_trip_controls['"]/)

  const loggingCalls = [roles, actions, trips, history, tripDetail]
    .flatMap((value) => value.match(/logServerError\([^\n]+/g) ?? [])
    .join('\n')

  assert.doesNotMatch(loggingCalls, /plateQuery|finishedFrom|finishedTo|user\.id|tripId|email/i)
})
