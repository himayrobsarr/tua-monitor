export function redactAnalyticsPathname(pathname: string) {
  const [pathOnly] = pathname.split(/[?#]/, 1)
  const segments = pathOnly.split('/')

  if (segments[1] === 'viajes' && segments[2] && segments[2] !== 'nuevo') {
    segments[2] = '[id]'
  }

  return segments.join('/')
}

export function redactAnalyticsUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    url.pathname = redactAnalyticsPathname(url.pathname)
    url.search = ''
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}
