import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationPath = join(
  repositoryRoot,
  'supabase',
  'migrations',
  '202609281200_audit_reason_whitespace_guard.sql',
)
const migration = await readFile(migrationPath, 'utf8')
const validationMigrationPath = join(
  repositoryRoot,
  'supabase',
  'migrations',
  '202609281300_validate_hardened_constraints.sql',
)
const validationMigration = await readFile(validationMigrationPath, 'utf8')

test('la base rechaza motivos compuestos solo por espacios visibles o Unicode', () => {
  assert.match(migration, /^begin;/)
  assert.match(migration, /commit;\s*$/)
  assert.match(migration, /whitespace_chars constant text := U&'/)
  assert.match(migration, /pg_catalog\.btrim\(new\.reason, whitespace_chars\)/)
  for (const codePoint of ['0009', '000B', '00A0', '2003', '200B', '2060', '3000', 'FEFF']) {
    assert.ok(migration.includes(`\\${codePoint}`), `falta U+${codePoint}`)
  }
  assert.doesNotMatch(migration, /\\v/)
  assert.match(migration, /new\.reason is not null and normalized_reason is null/)
  assert.match(migration, /errcode = 'TUA14'/)
  assert.match(migration, /before insert on public\.trip_events/)
  assert.match(migration, /revoke all on function public\.enforce_trip_event_reason\(\)/)
  assert.match(migration, /trip_events_reason_whitespace_v2_check/)
  assert.match(migration, /not valid;/)
})

test('la migración posterior valida todas las restricciones endurecidas de forma acotada', () => {
  assert.match(validationMigration, /^begin;/)
  assert.match(validationMigration, /set local lock_timeout = '5s';/)
  assert.match(validationMigration, /set local statement_timeout = '2min';/)

  for (const constraint of [
    'trips_status_v2_check',
    'trips_status_finished_at_v2_check',
    'trip_controls_control_type_v2_check',
    'trip_events_reason_whitespace_v2_check',
  ]) {
    assert.match(
      validationMigration,
      new RegExp(`validate constraint ${constraint};`),
      `falta validar ${constraint}`,
    )
  }

  assert.match(validationMigration, /commit;\s*$/)
})
