import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  dependencies,
  FakeLogicalClient,
  FakeRelaySession,
  host
} from './mobile-endpoint-supervisor-test-fakes'
import { MobileEndpointSupervisor } from './mobile-endpoint-supervisor'

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }))
vi.mock('expo-secure-store', () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when-unlocked' }))
vi.mock('expo-crypto', () => ({ getRandomBytes: (length: number) => new Uint8Array(length) }))

describe('browser relay supervision', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-13T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())
  it('keeps browser sessions on relay while renewing the initial lease', async () => {
    const logical = new FakeLogicalClient('connected', 'relay')
    const deps = dependencies()
    const initial = new FakeRelaySession('connected', null, Date.now() + 90_000)
    const supervisor = new MobileEndpointSupervisor(logical, host, {
      ...deps,
      relayOnly: true,
      initialRelaySession: initial
    })
    await supervisor.start()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(deps.openDirect).not.toHaveBeenCalled()
    expect(deps.openRelay).toHaveBeenCalled()
    supervisor.stop()
  })
})
