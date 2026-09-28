/**
 * Static contract tests for the trip lifecycle security boundary.
 *
 * These tests intentionally do not claim to execute or prove PostgreSQL RLS.
 * They cannot validate SQL syntax, deployed grants/owners, trigger ordering,
 * rollback behavior, locks under concurrency, JWT propagation, or remote
 * schema drift. Those properties still require pgTAP and integration tests
 * against a disposable Supabase database.
 */

import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const migrationPath = join(
  repositoryRoot,
  'supabase',
  'migrations',
  '202609261500_atomic_lifecycle_and_audit.sql',
)
const actionsPath = join(repositoryRoot, 'src', 'app', 'viajes', 'actions.ts')
const detailPagePath = join(repositoryRoot, 'src', 'app', 'viajes', '[id]', 'page.tsx')

const rawMigration = await readFile(migrationPath, 'utf8')
const actionsSource = await readFile(actionsPath, 'utf8')
const detailPageSource = await readFile(detailPagePath, 'utf8')

function stripSqlComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
}

function normalize(value) {
  return value.replace(/\s+/g, ' ').trim()
}

const migration = normalize(stripSqlComments(rawMigration))

function extractSqlFunction(name) {
  const startMatch = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\s*\\(`,
    'i',
  ).exec(rawMigration)

  assert.ok(startMatch, `No se encontró la función SQL public.${name}`)

  const bodyStart = rawMigration.indexOf('as $function$', startMatch.index)
  const bodyEnd = rawMigration.indexOf('$function$;', bodyStart + 1)

  assert.notEqual(bodyStart, -1, `public.${name} no usa el delimitador $function$ esperado`)
  assert.notEqual(bodyEnd, -1, `public.${name} no tiene cierre $function$`)

  return normalize(stripSqlComments(rawMigration.slice(startMatch.index, bodyEnd + '$function$;'.length)))
}

function assertMatches(value, patterns, context) {
  for (const pattern of patterns) {
    assert.match(value, pattern, `${context}: falta el contrato ${pattern}`)
  }
}

function assertBefore(value, firstPattern, secondPattern, context) {
  const first = value.search(firstPattern)
  const second = value.search(secondPattern)

  assert.notEqual(first, -1, `${context}: no se encontró ${firstPattern}`)
  assert.notEqual(second, -1, `${context}: no se encontró ${secondPattern}`)
  assert.ok(first < second, `${context}: ${firstPattern} debe aparecer antes de ${secondPattern}`)
}

const rpcContracts = {
  finish_trip: {
    action: 'finishTripAction',
    inputType: 'TripVersionInput',
    parameterNames: ['p_expected_updated_at', 'p_trip_id'],
    signature: /public\.finish_trip\s*\(\s*p_trip_id uuid,\s*p_expected_updated_at timestamptz\s*\)\s*returns jsonb/i,
    sqlTypes: /uuid,\s*timestamptz/i,
  },
  reopen_trip: {
    action: 'reopenTripAction',
    inputType: 'ReopenTripInput',
    parameterNames: ['p_expected_updated_at', 'p_reason', 'p_trip_id'],
    signature: /public\.reopen_trip\s*\(\s*p_trip_id uuid,\s*p_expected_updated_at timestamptz,\s*p_reason text\s*\)\s*returns jsonb/i,
    sqlTypes: /uuid,\s*timestamptz,\s*text/i,
  },
  update_trip_details: {
    action: 'updateTripDetailsAction',
    inputType: 'UpdateTripDetailsInput',
    parameterNames: [
      'p_destination',
      'p_driver',
      'p_expected_updated_at',
      'p_loading_date',
      'p_observations',
      'p_plate',
      'p_product',
      'p_reason',
      'p_trip_id',
      'p_warehouse',
    ],
    signature: /public\.update_trip_details\s*\(\s*p_trip_id uuid,\s*p_expected_updated_at timestamptz,\s*p_plate text,\s*p_driver text,\s*p_product text,\s*p_warehouse text,\s*p_destination text,\s*p_loading_date date,\s*p_observations text,\s*p_reason text\s*\)\s*returns jsonb/i,
    sqlTypes: /uuid,\s*timestamptz,\s*text,\s*text,\s*text,\s*text,\s*text,\s*date,\s*text,\s*text/i,
  },
  create_trip_control: {
    action: 'createTripControlAction',
    inputType: 'CreateTripControlInput',
    parameterNames: [
      'p_control_type',
      'p_incident',
      'p_observation',
      'p_reason',
      'p_reported_at',
      'p_reported_location',
      'p_trip_id',
    ],
    signature: /public\.create_trip_control\s*\(\s*p_trip_id uuid,\s*p_control_type text,\s*p_reported_location text,\s*p_incident text,\s*p_observation text,\s*p_reported_at timestamptz,\s*p_reason text\s*\)\s*returns jsonb/i,
    sqlTypes: /uuid,\s*text,\s*text,\s*text,\s*text,\s*timestamptz,\s*text/i,
  },
  update_trip_control: {
    action: 'updateTripControlAction',
    inputType: 'UpdateTripControlInput',
    parameterNames: [
      'p_control_id',
      'p_control_type',
      'p_expected_updated_at',
      'p_incident',
      'p_observation',
      'p_reason',
      'p_reported_at',
      'p_reported_location',
    ],
    signature: /public\.update_trip_control\s*\(\s*p_control_id uuid,\s*p_expected_updated_at timestamptz,\s*p_control_type text,\s*p_reported_location text,\s*p_incident text,\s*p_observation text,\s*p_reported_at timestamptz,\s*p_reason text\s*\)\s*returns jsonb/i,
    sqlTypes: /uuid,\s*timestamptz,\s*text,\s*text,\s*text,\s*text,\s*timestamptz,\s*text/i,
  },
}

test('la migración fija una superficie RPC privilegiada y retira escrituras directas', () => {
  assert.match(migration, /^begin;/i)
  assert.match(migration, /commit;$/i)

  for (const [rpcName, contract] of Object.entries(rpcContracts)) {
    const sqlFunction = extractSqlFunction(rpcName)
    assert.match(sqlFunction, contract.signature)
    assertMatches(
      sqlFunction,
      [/language plpgsql/i, /security definer/i, /set search_path = pg_catalog, public/i],
      rpcName,
    )

    const revokePattern = new RegExp(
      `revoke\\s+all\\s+on\\s+function\\s+public\\.${rpcName}\\s*\\(\\s*${contract.sqlTypes.source}\\s*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
      'i',
    )
    const grantPattern = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+public\\.${rpcName}\\s*\\(\\s*${contract.sqlTypes.source}\\s*\\)\\s+to\\s+authenticated`,
      'i',
    )

    assertBefore(migration, revokePattern, grantPattern, rpcName)
  }

  assertMatches(
    migration,
    [
      /alter table public\.trips enable row level security/i,
      /create policy tua_trip_insert_state_guard_v1 on public\.trips as restrictive for insert to authenticated with check \(.*current_tua_role\(\).* = 'admin'.*status::text = 'EN_ROUTE'.*finished_at is null.*\)/i,
      /create trigger enforce_new_trip_state before insert on public\.trips for each row execute function public\.enforce_new_trip_state\(\)/i,
      /revoke update on table public\.trips from authenticated/i,
      /revoke insert, update on table public\.trip_controls from authenticated/i,
    ],
    'privilegios finales',
  )

  const enforceNewTrip = extractSqlFunction('enforce_new_trip_state')
  assertMatches(
    enforceNewTrip,
    [
      /security definer/i,
      /set search_path = pg_catalog, public/i,
      /new\.status := 'EN_ROUTE'/i,
      /new\.finished_at := null/i,
      /new\.created_at := database_time/i,
      /new\.updated_at := database_time/i,
    ],
    'enforce_new_trip_state',
  )
})

test('los RPC validan actor, versión, estado, bloqueo y motivo', () => {
  const finish = extractSqlFunction('finish_trip')
  assertMatches(
    finish,
    [
      /auth\.uid\(\) is null.*current_tua_role\(\) is distinct from 'admin'.*'TUA10'/i,
      /where t\.id = p_trip_id for update of t/i,
      /updated_at is distinct from p_expected_updated_at.*'TUA15'/i,
      /status::text is distinct from 'EN_ROUTE'.*'TUA12'/i,
      /set status = 'FINISHED', finished_at = pg_catalog\.clock_timestamp\(\)/i,
    ],
    'finish_trip',
  )

  const reopen = extractSqlFunction('reopen_trip')
  assertMatches(
    reopen,
    [
      /auth\.uid\(\) is null.*current_tua_role\(\) is distinct from 'admin'.*'TUA10'/i,
      /change_reason is null or pg_catalog\.length\(change_reason\) > 2000.*'TUA14'/i,
      /where t\.id = p_trip_id for update of t/i,
      /updated_at is distinct from p_expected_updated_at.*'TUA15'/i,
      /status::text is distinct from 'FINISHED'.*'TUA13'/i,
      /set status = 'EN_ROUTE', finished_at = null/i,
    ],
    'reopen_trip',
  )
  assertBefore(
    reopen,
    /set_config\('tua\.audit_reason', change_reason, true\)/i,
    /update public\.trips/i,
    'reopen_trip audit reason',
  )

  const updateDetails = extractSqlFunction('update_trip_details')
  assertMatches(
    updateDetails,
    [
      /current_tua_role\(\) is distinct from 'admin'.*'TUA10'/i,
      /normalized_plate is null or normalized_plate = '' or normalized_driver is null or normalized_driver = '' or p_loading_date is null.*'TUA16'/i,
      /where t\.id = p_trip_id for update of t/i,
      /updated_at is distinct from p_expected_updated_at.*'TUA15'/i,
      /change_reason is not null and pg_catalog\.length\(change_reason\) > 2000.*'TUA14'/i,
      /status::text is distinct from 'EN_ROUTE' and change_reason is null.*'TUA14'/i,
    ],
    'update_trip_details',
  )
  const tripSetClause = /update public\.trips as t set (.*?) where t\.id = p_trip_id/i.exec(updateDetails)?.[1]
  assert.ok(tripSetClause, 'update_trip_details debe tener un UPDATE acotado')
  assert.doesNotMatch(tripSetClause, /\b(?:status|finished_at|created_at|id)\s*=/i)

  const createControl = extractSqlFunction('create_trip_control')
  assertMatches(
    createControl,
    [
      /auth\.uid\(\) is null or \( tua_role is distinct from 'admin' and tua_role is distinct from 'reporter' \).*'TUA18'/i,
      /p_control_type is null or p_control_type not in \('STOP', 'FINAL_ARRIVAL'\).*'TUA30'/i,
      /normalized_location is null or normalized_location = ''.*'TUA16'/i,
      /where t\.id = p_trip_id for share of t/i,
      /tua_role = 'reporter' and trip_status is distinct from 'EN_ROUTE'.*'TUA01'/i,
      /change_reason is not null and pg_catalog\.length\(change_reason\) > 2000.*'TUA14'/i,
      /tua_role = 'admin' and trip_status is distinct from 'EN_ROUTE' and change_reason is null.*'TUA14'/i,
      /when tua_role = 'reporter' then pg_catalog\.clock_timestamp\(\)/i,
      /reported_by \) values \(.*auth\.uid\(\)/i,
    ],
    'create_trip_control',
  )
  assert.doesNotMatch(createControl, /tua_role not in \('admin', 'reporter'\)/i)

  const updateControl = extractSqlFunction('update_trip_control')
  assertMatches(
    updateControl,
    [
      /current_tua_role\(\) is distinct from 'admin'.*'TUA10'/i,
      /p_control_type is null or p_control_type not in \('STOP', 'FINAL_ARRIVAL'\).*'TUA30'/i,
      /normalized_location is null or normalized_location = '' or p_reported_at is null.*'TUA16'/i,
      /where c\.id = p_control_id for update of c/i,
      /updated_at is distinct from p_expected_updated_at.*'TUA15'/i,
      /where t\.id = control_before\.trip_id for share of t/i,
      /change_reason is not null and pg_catalog\.length\(change_reason\) > 2000.*'TUA14'/i,
      /trip_status is distinct from 'EN_ROUTE' and change_reason is null.*'TUA14'/i,
    ],
    'update_trip_control',
  )
  const controlSetClause = /update public\.trip_controls as c set (.*?) where c\.id = p_control_id/i.exec(updateControl)?.[1]
  assert.ok(controlSetClause, 'update_trip_control debe tener un UPDATE acotado')
  assert.doesNotMatch(
    controlSetClause,
    /\b(?:trip_id|reported_by|created_at|updated_at|id)\s*=/i,
  )

  for (const code of [
    'TUA01',
    'TUA10',
    'TUA11',
    'TUA12',
    'TUA13',
    'TUA14',
    'TUA15',
    'TUA16',
    'TUA17',
    'TUA18',
    'TUA20',
    'TUA30',
  ]) {
    assert.match(migration, new RegExp(`'${code}'`), `Falta el código de error estable ${code}`)
  }
})

test('la auditoría es append-only, conserva contexto y solo la consulta admin', () => {
  assertMatches(
    migration,
    [
      /create table if not exists public\.trip_events \(.*trip_id uuid not null references public\.trips \(id\) on delete restrict.*control_id uuid references public\.trip_controls \(id\) on delete restrict/i,
      /occurred_at timestamptz not null default pg_catalog\.clock_timestamp\(\)/i,
      /before_state jsonb, after_state jsonb, reason text/i,
      /alter table public\.trip_events enable row level security/i,
      /revoke all on table public\.trip_events from public, anon, authenticated/i,
      /grant select on table public\.trip_events to authenticated/i,
      /create policy tua_admin_read_trip_events_v1 on public\.trip_events for select to authenticated using \(\(select public\.current_tua_role\(\)\) = 'admin'\)/i,
      /before update or delete on public\.trip_events for each row execute function public\.reject_trip_event_mutation\(\)/i,
      /before truncate on public\.trip_events for each statement execute function public\.reject_trip_event_mutation\(\)/i,
      /after insert or update on public\.trips for each row execute function public\.audit_trip_change\(\)/i,
      /after insert or update on public\.trip_controls for each row execute function public\.audit_trip_control_change\(\)/i,
    ],
    'trip_events',
  )

  const rejectMutation = extractSqlFunction('reject_trip_event_mutation')
  assertMatches(rejectMutation, [/security definer/i, /'TUA20'/i], 'append-only')

  const auditTrip = extractSqlFunction('audit_trip_change')
  assertMatches(
    auditTrip,
    [
      /security definer/i,
      /set search_path = pg_catalog, public/i,
      /old\.status::text is distinct from 'EN_ROUTE'/i,
      /auth\.uid\(\).*public\.current_tua_role\(\).*to_jsonb\(old\).*to_jsonb\(new\).*audit_reason/i,
    ],
    'audit_trip_change',
  )

  const auditControl = extractSqlFunction('audit_trip_control_change')
  assertMatches(
    auditControl,
    [
      /security definer/i,
      /set search_path = pg_catalog, public/i,
      /parent_status is distinct from 'EN_ROUTE'/i,
      /auth\.uid\(\).*public\.current_tua_role\(\).*to_jsonb\(old\).*to_jsonb\(new\).*audit_reason/i,
    ],
    'audit_trip_control_change',
  )

  for (const internalFunction of [
    'enforce_new_trip_state',
    'reject_trip_event_mutation',
    'set_tua_updated_at',
    'enforce_current_trip_control_type',
    'audit_trip_change',
    'audit_trip_control_change',
  ]) {
    assert.match(
      migration,
      new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${internalFunction}\\s*\\(\\s*\\)\\s+from\\s+public,\\s*anon,\\s*authenticated`,
        'i',
      ),
      `${internalFunction} no debe poder invocarse como endpoint`,
    )
  }
})

function parseSource(filePath, source) {
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    extname(filePath) === '.tsx' ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
}

function visit(node, callback) {
  callback(node)
  node.forEachChild((child) => visit(child, callback))
}

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
    return node.text
  }
  return null
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some((modifier) => modifier.kind === kind))
}

function enclosingFunctionName(node) {
  let current = node.parent

  while (current) {
    if (ts.isFunctionDeclaration(current)) return current.name?.text ?? null
    if (
      (ts.isArrowFunction(current) || ts.isFunctionExpression(current))
      && ts.isVariableDeclaration(current.parent)
      && ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text
    }
    current = current.parent
  }

  return null
}

async function sourceFilesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await sourceFilesUnder(path))
    else if (entry.isFile() && ['.ts', '.tsx'].includes(extname(entry.name))) files.push(path)
  }

  return files
}

test('la aplicación muta el ciclo de vida solo mediante Server Actions y RPC tipados', async () => {
  const actionFile = parseSource(actionsPath, actionsSource)
  const firstStatement = actionFile.statements[0]
  assert.ok(
    firstStatement
      && ts.isExpressionStatement(firstStatement)
      && ts.isStringLiteral(firstStatement.expression)
      && firstStatement.expression.text === 'use server',
    'actions.ts debe comenzar con la directiva use server',
  )

  const actionFunctions = new Map()
  const rpcCalls = new Map()

  visit(actionFile, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) actionFunctions.set(node.name.text, node)

    if (
      !ts.isCallExpression(node)
      || !ts.isPropertyAccessExpression(node.expression)
      || node.expression.name.text !== 'rpc'
    ) return

    const [rpcArgument, paramsArgument] = node.arguments
    assert.ok(ts.isStringLiteral(rpcArgument), 'El nombre RPC debe ser un literal')
    assert.ok(ts.isObjectLiteralExpression(paramsArgument), `${rpcArgument.text} debe recibir un objeto literal`)

    const parameters = []
    for (const property of paramsArgument.properties) {
      assert.ok(
        ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property),
        `${rpcArgument.text} no debe usar spreads ni propiedades calculadas`,
      )
      const name = propertyName(property.name)
      assert.ok(name, `${rpcArgument.text} contiene una clave de parámetro no estática`)
      parameters.push(name)
    }

    assert.ok(!rpcCalls.has(rpcArgument.text), `El RPC ${rpcArgument.text} se invoca más de una vez`)
    rpcCalls.set(rpcArgument.text, {
      actionName: enclosingFunctionName(node),
      parameters: parameters.sort(),
    })
  })

  for (const [rpcName, contract] of Object.entries(rpcContracts)) {
    const action = actionFunctions.get(contract.action)
    assert.ok(action, `Falta el Server Action ${contract.action}`)
    assert.ok(hasModifier(action, ts.SyntaxKind.ExportKeyword), `${contract.action} debe exportarse`)
    assert.ok(hasModifier(action, ts.SyntaxKind.AsyncKeyword), `${contract.action} debe ser async`)
    assert.equal(action.parameters.length, 1, `${contract.action} debe recibir un solo input tipado`)
    assert.equal(action.parameters[0].type?.getText(actionFile), contract.inputType)
    assert.equal(action.type?.getText(actionFile), 'Promise<TripActionResult>')

    const rpcCall = rpcCalls.get(rpcName)
    assert.ok(rpcCall, `Falta la llamada al RPC ${rpcName}`)
    assert.equal(rpcCall.actionName, contract.action, `${contract.action} debe ser quien invoque ${rpcName}`)
    assert.deepEqual(rpcCall.parameters, [...contract.parameterNames].sort())

    const actionText = normalize(action.getText(actionFile))
    assert.match(actionText, /await authorize\(/, `${contract.action} debe autorizar en servidor`)
    assert.match(actionText, /mapRpcError\(/, `${contract.action} debe mapear errores RPC`)
    assert.match(actionText, /hasRpcId\(data\)/, `${contract.action} debe validar la respuesta RPC`)
    assert.match(actionText, /revalidateTrip\(/, `${contract.action} debe invalidar las vistas del viaje`)
  }

  assert.deepEqual([...rpcCalls.keys()].sort(), Object.keys(rpcContracts).sort())
  assert.doesNotMatch(actionsSource, /error\.(?:message|details|hint)/)
  assert.doesNotMatch(actionsSource, /throw\s+error\b/)

  for (const code of [
    'TUA01',
    'TUA10',
    'TUA11',
    'TUA12',
    'TUA13',
    'TUA14',
    'TUA15',
    'TUA16',
    'TUA17',
    'TUA18',
    'TUA30',
  ]) {
    assert.match(actionsSource, new RegExp(`case ['"]${code}['"]:`), `mapRpcError no cubre ${code}`)
  }

  const forbiddenMutations = []
  for (const filePath of await sourceFilesUnder(join(repositoryRoot, 'src'))) {
    const source = await readFile(filePath, 'utf8')
    const sourceFile = parseSource(filePath, source)

    visit(sourceFile, (node) => {
      if (
        !ts.isCallExpression(node)
        || !ts.isPropertyAccessExpression(node.expression)
        || !['insert', 'update', 'upsert', 'delete'].includes(node.expression.name.text)
      ) return

      const mutation = node.expression.name.text
      const receiver = node.expression.expression.getText(sourceFile)
      const tableMatch = receiver.match(/\.from\(\s*['"](trips|trip_controls|trip_events)['"]\s*\)/)
      if (!tableMatch) return

      const table = tableMatch[1]
      const allowedInitialTripInsert = table === 'trips' && mutation === 'insert'
      if (!allowedInitialTripInsert) {
        forbiddenMutations.push(`${relative(repositoryRoot, filePath)}: ${table}.${mutation}`)
      }
    })
  }

  assert.deepEqual(
    forbiddenMutations,
    [],
    `Se encontraron mutaciones que eluden los RPC: ${forbiddenMutations.join(', ')}`,
  )
})

test('los errores remotos generan diagnósticos seguros y estructurados', () => {
  assert.match(actionsSource, /event:\s*['"]trip_rpc_failed['"]/)
  assert.match(actionsSource, /code:\s*error\.code\s*\?\?\s*['"]UNKNOWN['"]/)
  assert.match(actionsSource, /operation,/)
  assert.doesNotMatch(actionsSource, /error\.(?:message|details|hint)/)

  assert.match(
    detailPageSource,
    /logServerError\(['"]trip_events_query_failed['"],\s*['"]select_trip_events['"],\s*eventsError\)/,
  )
  assert.doesNotMatch(detailPageSource, /eventsError\.(?:message|details|hint)/)
})
