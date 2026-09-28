export const LOGIN_MESSAGES = {
  emailRequired: 'Ingresa tu correo electrónico.',
  emailInvalid: 'Ingresa un correo electrónico válido.',
  passwordRequired: 'Ingresa tu contraseña.',
  invalidCredentials:
    'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.',
  tooManyAttempts:
    'Has realizado demasiados intentos. Espera unos minutos antes de volver a intentarlo.',
  serviceUnavailable:
    'No fue posible conectar con el servicio de autenticación. Inténtalo de nuevo.',
} as const

export type LoginField = 'email' | 'password'

export type LoginFeedback = {
  field: LoginField | null
  message: string
}

export type LoginValidationResult =
  | {
      ok: true
      email: string
      password: string
    }
  | {
      ok: false
      feedback: LoginFeedback
    }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u
const MAX_EMAIL_LENGTH = 254

const ACCOUNT_STATE_ERROR_CODES = new Set([
  'email_address_not_authorized',
  'email_exists',
  'email_not_confirmed',
  'identity_not_found',
  'invalid_credentials',
  'phone_exists',
  'user_already_exists',
  'user_banned',
  'user_not_found',
])

const RATE_LIMIT_ERROR_CODES = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'over_sms_send_rate_limit',
])

export function normalizeLoginEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function validateLoginCredentials(
  emailValue: unknown,
  passwordValue: unknown,
): LoginValidationResult {
  const email = normalizeLoginEmail(emailValue)
  const password = typeof passwordValue === 'string' ? passwordValue : ''

  if (!email) {
    return {
      ok: false,
      feedback: { field: 'email', message: LOGIN_MESSAGES.emailRequired },
    }
  }

  if (email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return {
      ok: false,
      feedback: { field: 'email', message: LOGIN_MESSAGES.emailInvalid },
    }
  }

  if (!password) {
    return {
      ok: false,
      feedback: { field: 'password', message: LOGIN_MESSAGES.passwordRequired },
    }
  }

  return { ok: true, email, password }
}

export function classifyLoginAuthError(error: unknown): LoginFeedback {
  const errorRecord = isRecord(error) ? error : null
  const code =
    typeof errorRecord?.code === 'string' ? errorRecord.code.toLowerCase() : ''
  const status = typeof errorRecord?.status === 'number' ? errorRecord.status : null

  if (code === 'email_address_invalid') {
    return { field: 'email', message: LOGIN_MESSAGES.emailInvalid }
  }

  if (RATE_LIMIT_ERROR_CODES.has(code) || status === 429) {
    return { field: null, message: LOGIN_MESSAGES.tooManyAttempts }
  }

  if (
    ACCOUNT_STATE_ERROR_CODES.has(code) ||
    status === 400 ||
    status === 401 ||
    status === 403
  ) {
    return { field: 'password', message: LOGIN_MESSAGES.invalidCredentials }
  }

  return { field: null, message: LOGIN_MESSAGES.serviceUnavailable }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
