import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

import ts from 'typescript'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const helperPath = join(repositoryRoot, 'src', 'lib', 'login.ts')
const componentPath = join(repositoryRoot, 'src', 'components', 'login-form.tsx')
const helperSource = await readFile(helperPath, 'utf8')
const componentSource = await readFile(componentPath, 'utf8')
const compiledHelper = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText
const login = await import(
  `data:text/javascript;base64,${Buffer.from(compiledHelper).toString('base64')}`
)

test('normaliza el correo sin modificar la contraseña', () => {
  const result = login.validateLoginCredentials(
    '  Operaciones@Empresa.COM  ',
    '  contraseña con espacios  ',
  )

  assert.deepEqual(result, {
    ok: true,
    email: 'operaciones@empresa.com',
    password: '  contraseña con espacios  ',
  })
})

test('valida correo y contraseña con mensajes en español', () => {
  assert.deepEqual(login.validateLoginCredentials('   ', 'secreto'), {
    ok: false,
    feedback: { field: 'email', message: login.LOGIN_MESSAGES.emailRequired },
  })
  assert.deepEqual(login.validateLoginCredentials('correo-invalido', 'secreto'), {
    ok: false,
    feedback: { field: 'email', message: login.LOGIN_MESSAGES.emailInvalid },
  })
  assert.deepEqual(login.validateLoginCredentials('persona@empresa.com', ''), {
    ok: false,
    feedback: { field: 'password', message: login.LOGIN_MESSAGES.passwordRequired },
  })
})

test('los estados de cuenta sensibles comparten una respuesta no enumerable', () => {
  const sensitiveCodes = [
    'invalid_credentials',
    'email_not_confirmed',
    'user_banned',
    'user_not_found',
    'identity_not_found',
    'email_address_not_authorized',
    'email_exists',
    'user_already_exists',
  ]
  const expected = {
    field: 'password',
    message: login.LOGIN_MESSAGES.invalidCredentials,
  }

  for (const code of sensitiveCodes) {
    assert.deepEqual(login.classifyLoginAuthError({ code }), expected)
  }

  assert.deepEqual(login.classifyLoginAuthError({ status: 400 }), expected)
})

test('clasifica límites y fallos del servicio sin propagar mensajes de Supabase', () => {
  assert.deepEqual(login.classifyLoginAuthError({ status: 429 }), {
    field: null,
    message: login.LOGIN_MESSAGES.tooManyAttempts,
  })
  assert.deepEqual(login.classifyLoginAuthError({ code: 'request_timeout', status: 504 }), {
    field: null,
    message: login.LOGIN_MESSAGES.serviceUnavailable,
  })
  assert.deepEqual(
    login.classifyLoginAuthError({
      code: 'future_auth_error',
      message: 'internal account detail that must stay private',
    }),
    { field: null, message: login.LOGIN_MESSAGES.serviceUnavailable },
  )
})

test('el formulario usa el helper, normaliza el valor visible y enfoca el campo inválido', () => {
  assert.match(componentSource, /validateLoginCredentials\(/)
  assert.match(componentSource, /emailRef\.current\.value = validation\.email/)
  assert.match(componentSource, /requestAnimationFrame\(\(\) =>/)
  assert.match(componentSource, /emailRef\.current\?\.focus\(\)/)
  assert.match(componentSource, /passwordRef\.current\?\.focus\(\)/)
  assert.match(componentSource, /onChange=\{\(\) => clearFieldFeedback\('email'\)\}/)
  assert.match(componentSource, /onChange=\{\(\) => clearFieldFeedback\('password'\)\}/)
  assert.match(componentSource, /aria-invalid=\{invalidField === 'email'\}/)
  assert.match(componentSource, /aria-invalid=\{invalidField === 'password'\}/)
  assert.match(componentSource, /classifyLoginAuthError\(error\)/)
  assert.doesNotMatch(componentSource, /error\.message/)
})
