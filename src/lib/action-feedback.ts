'use client'

import { notifyError } from '@/lib/notifications'
import type { TripActionResult } from '@/types/actions'

type TripActionFailure = Extract<TripActionResult, { ok: false }>

type ActionFailureFeedback = {
  refresh: () => void
  setInlineError: (message: string) => void
}

export function handleTripActionFailure(
  result: TripActionFailure,
  { refresh, setInlineError }: ActionFailureFeedback,
) {
  if (result.refresh) {
    notifyError(result.message)
    refresh()
    return
  }

  setInlineError(result.message)
}
