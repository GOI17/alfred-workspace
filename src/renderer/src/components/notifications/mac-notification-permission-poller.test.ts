import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationDeliveryProbeResult } from '../../../../shared/notification-settings-types'
import { startMacNotificationPermissionPolling } from './mac-notification-permission-poller'

function notificationApi() {
  return {
    getPermissionStatus: vi.fn(async () => ({
      platform: 'darwin' as const,
      supported: true,
      requested: true
    })),
    probeDelivery: vi.fn(async (): Promise<NotificationDeliveryProbeResult> => ({
      state: 'blocked',
      authoritative: true
    }))
  }
}

describe('macOS permission polling lifetime', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('cancels the next probe when disposed', async () => {
    const api = notificationApi()
    const onChange = vi.fn()
    const dispose = startMacNotificationPermissionPolling(api, onChange)
    await vi.advanceTimersByTimeAsync(0)
    expect(onChange).toHaveBeenLastCalledWith('blocked')
    expect(vi.getTimerCount()).toBe(1)

    dispose()
    await vi.advanceTimersByTimeAsync(5000)
    expect(api.probeDelivery).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores an in-flight probe that resolves after disposal', async () => {
    const api = notificationApi()
    let complete = (_result: NotificationDeliveryProbeResult): void => {}
    api.probeDelivery.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        })
    )
    const onChange = vi.fn()
    const dispose = startMacNotificationPermissionPolling(api, onChange)
    await vi.advanceTimersByTimeAsync(0)
    dispose()
    onChange.mockClear()
    complete({ state: 'blocked', authoritative: true })
    await vi.advanceTimersByTimeAsync(5000)

    expect(onChange).not.toHaveBeenCalled()
    expect(api.probeDelivery).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps authoritative readouts live but stops a delivered banner fallback', async () => {
    const api = notificationApi()
    api.probeDelivery.mockResolvedValueOnce({ state: 'delivered', authoritative: true })
    api.probeDelivery.mockResolvedValue({ state: 'delivered', authoritative: false })
    const dispose = startMacNotificationPermissionPolling(api, vi.fn())
    await vi.advanceTimersByTimeAsync(10000)

    expect(api.probeDelivery).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
    dispose()
  })
})
