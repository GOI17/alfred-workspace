import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AlfredProfileAuthStatus } from '../../../../shared/alfred-profiles'
import { createTestStore } from '../../store/slices/store-test-helpers'

const { storeHolder } = vi.hoisted(() => ({
  storeHolder: { current: null as { getState: () => unknown } | null }
}))

vi.mock('../../store', () => ({
  useAppStore: { getState: () => storeHolder.current?.getState() }
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }
}))

import { registerAlfredProfileAuthIpcBridge } from './alfred-profile-auth-ipc-bridge'

const connectedAuthStatus: AlfredProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted'
}

const reconnectRequiredAuthStatus: AlfredProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'reconnect-required',
  persistence: 'encrypted'
}

describe('alfred profile auth IPC bridge', () => {
  let listener: (() => void) | null = null
  const unsubscribe = vi.fn()
  const authStatus = vi.fn()

  beforeEach(() => {
    listener = null
    unsubscribe.mockClear()
    authStatus.mockReset()
    vi.stubGlobal('window', {
      api: {
        alfredProfiles: {
          authStatus,
          onAuthStatusChanged: (callback: () => void) => {
            listener = callback
            return unsubscribe
          }
        }
      }
    })
  })

  it('re-fetches auth status on the push, flipping connected to reconnect-required', async () => {
    authStatus.mockResolvedValue(connectedAuthStatus)
    const store = createTestStore()
    storeHolder.current = store
    await store.getState().fetchAlfredProfileAuthStatus()
    expect(store.getState().alfredProfileAuthStatus).toEqual(connectedAuthStatus)

    const unsubs: (() => void)[] = []
    registerAlfredProfileAuthIpcBridge(unsubs)
    authStatus.mockResolvedValue(reconnectRequiredAuthStatus)
    listener?.()
    await vi.waitFor(() =>
      expect(store.getState().alfredProfileAuthStatus).toEqual(reconnectRequiredAuthStatus)
    )

    unsubs.forEach((dispose) => dispose())
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('skips registration when the preload bridge does not expose the event', () => {
    vi.stubGlobal('window', { api: { alfredProfiles: { authStatus } } })
    const unsubs: (() => void)[] = []

    registerAlfredProfileAuthIpcBridge(unsubs)

    expect(unsubs).toHaveLength(0)
  })
})
