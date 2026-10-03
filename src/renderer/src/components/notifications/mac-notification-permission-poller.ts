import type { NotificationDeliveryProbeResult } from '../../../../shared/notification-settings-types'

export type MacNotificationPermissionState =
  | 'checking'
  | 'awaiting-permission'
  | 'enabled'
  | 'blocked'

const MAC_PROBE_POLL_INTERVAL_MS = 2500
// Why: bounded so an abandoned onboarding tab doesn't probe forever; ~3
// minutes comfortably covers answering the dialog or flipping the toggle
// in System Settings.
const MAC_PROBE_POLL_MAX_ATTEMPTS = 72

export function resolveMacNotificationPermissionState(
  probeState: NotificationDeliveryProbeResult['state'],
  promptedBefore: boolean
): MacNotificationPermissionState | null {
  if (probeState === 'unsupported') {
    return null
  }
  if (probeState === 'delivered') {
    return 'enabled'
  }
  if (probeState === 'awaiting-decision') {
    return 'awaiting-permission'
  }
  // Why: probe-fallback hosts can't tell "unanswered dialog" from "denied" —
  // a first-ever probe is what makes macOS show the permission dialog, so
  // its rejection means "unanswered", not "denied".
  return promptedBefore ? 'blocked' : 'awaiting-permission'
}

export function startMacNotificationPermissionPolling(
  notifications: Pick<Window['api']['notifications'], 'getPermissionStatus' | 'probeDelivery'>,
  onChange: (state: MacNotificationPermissionState | null) => void
): () => void {
  let cancelled = false
  let pollTimer: ReturnType<typeof setTimeout> | undefined
  let pollAttempts = 0

  function schedulePoll(promptedBefore: boolean): void {
    if (cancelled || pollAttempts >= MAC_PROBE_POLL_MAX_ATTEMPTS) {
      return
    }
    pollTimer = setTimeout(() => {
      pollAttempts += 1
      void notifications.probeDelivery({ force: true }).then((probe) => {
        if (cancelled) {
          return
        }
        onChange(resolveMacNotificationPermissionState(probe.state, promptedBefore))
        // Why: authoritative readouts are silent, so keep tracking System
        // Settings live in every state — flipping the toggle updates the
        // card within a poll. Probe fallbacks flash a banner when delivery
        // works, so for them polling stops once the card turns green.
        if (probe.authoritative || probe.state !== 'delivered') {
          schedulePoll(promptedBefore)
        }
      })
    }, MAC_PROBE_POLL_INTERVAL_MS)
  }

  void (async () => {
    const status = await notifications.getPermissionStatus()
    if (cancelled) {
      return
    }
    if (status.platform !== 'darwin' || !status.supported) {
      return
    }
    onChange('checking')
    // Why: `status.requested` is read before the probe stamps it, so a
    // fresh install (where the check itself pops the macOS dialog) renders
    // as "answer the dialog" instead of "blocked" on probe-fallback hosts.
    const probe = await notifications.probeDelivery()
    if (cancelled) {
      return
    }
    const resolved = resolveMacNotificationPermissionState(probe.state, status.requested)
    onChange(resolved)
    if (resolved !== null && (probe.authoritative || resolved !== 'enabled')) {
      schedulePoll(status.requested)
    }
  })()

  return () => {
    cancelled = true
    clearTimeout(pollTimer)
  }
}
