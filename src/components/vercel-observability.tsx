'use client'

import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

import { redactAnalyticsPathname, redactAnalyticsUrl } from '@/lib/observability'

export function VercelObservability() {
  return <>
    <Analytics beforeSend={(event) => {
      const url = redactAnalyticsUrl(event.url)
      return url ? { ...event, url } : null
    }} />
    <SpeedInsights beforeSend={(event) => {
      const url = redactAnalyticsUrl(event.url)
      if (!url) return null

      return {
        ...event,
        url,
        route: event.route ? redactAnalyticsPathname(event.route) : event.route,
      }
    }} />
  </>
}
