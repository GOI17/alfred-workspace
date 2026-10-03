import { useEffect, useState } from 'react'
import { BellRing, Check, Settings, TriangleAlert } from 'lucide-react'
import {
  startMacNotificationPermissionPolling,
  type MacNotificationPermissionState
} from './mac-notification-permission-poller'
export { resolveMacNotificationPermissionState } from './mac-notification-permission-poller'
export type { MacNotificationPermissionState } from './mac-notification-permission-poller'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'

export function useMacNotificationPermissionState(
  enabled: boolean = true
): [MacNotificationPermissionState | null, (state: MacNotificationPermissionState | null) => void] {
  const [macPermissionState, setMacPermissionState] =
    useState<MacNotificationPermissionState | null>(null)

  useEffect(() => {
    // Why: while Alfred's own notifications setting is off, the OS permission
    // is irrelevant — a green "notifications are enabled" card next to a
    // disabled toggle reads as a contradiction. Hide the card and skip the
    // readout polling entirely until the setting is back on.
    if (!enabled) {
      return
    }
    return startMacNotificationPermissionPolling(window.api.notifications, setMacPermissionState)
  }, [enabled])

  return [enabled ? macPermissionState : null, setMacPermissionState]
}

export function MacNotificationPermissionCard({
  state
}: {
  state: MacNotificationPermissionState | null
}): React.JSX.Element | null {
  if (state === 'checking') {
    return (
      <section className="rounded-xl border border-border bg-muted/20 px-5 py-4 text-[13px] text-muted-foreground">
        {translate(
          'auto.components.onboarding.NotificationStep.56b836215c',
          'Checking notification permission…'
        )}
      </section>
    )
  }

  if (state === 'enabled') {
    return (
      <section className="flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.07] px-5 py-4">
        <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground">
            {translate(
              'auto.components.onboarding.NotificationStep.fd84d3e9b8',
              'Notifications are enabled'
            )}
          </div>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            {translate(
              'auto.components.onboarding.NotificationStep.4f7bce5644',
              'macOS will alert you when agents finish or terminals need attention.'
            )}
          </p>
        </div>
      </section>
    )
  }

  if (state === 'awaiting-permission') {
    return (
      <section className="rounded-xl border border-border bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <BellRing className="size-4" />
              {translate(
                'auto.components.onboarding.NotificationStep.95d99b52fa',
                'Allow notifications for Alfred'
              )}
            </div>
            <p className="max-w-[58ch] text-[13px] leading-relaxed text-muted-foreground">
              {translate(
                'auto.components.onboarding.mac.notification.permission.card.f696515944',
                'Click Allow in the macOS dialog.'
              )}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void window.api.notifications.openSystemSettings()}
          >
            <Settings className="size-3.5" />
            {translate(
              'auto.components.onboarding.NotificationStep.4f6a1da718',
              'Open System Settings'
            )}
          </Button>
        </div>
      </section>
    )
  }

  if (state === 'blocked') {
    return (
      <section
        role="alert"
        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <TriangleAlert className="size-4" />
              {translate(
                'auto.components.onboarding.NotificationStep.90b5d2e363',
                'macOS is not delivering Alfred notifications'
              )}
            </div>
            <p className="max-w-[58ch] text-[13px] leading-relaxed text-amber-700/80 dark:text-amber-200/80">
              {translate(
                'auto.components.onboarding.mac.notification.permission.card.721d2bedb6',
                'Turn on Allow notifications for Alfred in System Settings.'
              )}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => void window.api.notifications.openSystemSettings()}
          >
            <Settings className="size-3.5" />
            {translate(
              'auto.components.onboarding.NotificationStep.4f6a1da718',
              'Open System Settings'
            )}
          </Button>
        </div>
      </section>
    )
  }

  return null
}
