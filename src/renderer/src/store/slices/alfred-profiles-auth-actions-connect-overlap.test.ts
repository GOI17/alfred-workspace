import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ConnectCurrentAlfredProfileResult,
  AlfredProfileAuthStatus,
  AlfredProfileListState,
  SignOutCurrentAlfredProfileResult
} from '../../../../shared/alfred-profiles'
import { createTestStore } from './store-test-helpers'

const { toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn()
}))

vi.mock('sonner', () => ({
  toast: {
    error: toastErrorMock,
    info: vi.fn(),
    success: toastSuccessMock,
    warning: vi.fn()
  }
}))

const listState: AlfredProfileListState = {
  activeProfileId: 'local-default',
  profiles: [
    {
      id: 'local-default',
      name: 'Personal',
      avatar: { kind: 'initials', initials: 'P', color: 'neutral' },
      kind: 'local',
      createdAt: 1,
      updatedAt: 1,
      lastOpenedAt: 1
    }
  ]
}

const connectedCloud = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  linkedAt: 3
}

const connectedAuthStatus: AlfredProfileAuthStatus = {
  activeProfileId: 'local-default',
  configured: true,
  state: 'connected',
  persistence: 'encrypted',
  cloud: connectedCloud,
  organizations: [{ orgId: 'org-1', name: 'Acme', role: 'Admin' }],
  capabilities: { flags: { share: true }, refreshedAt: 4 }
}

const alfredProfilesApi = {
  connectCurrent: vi.fn(),
  signOutCurrent: vi.fn()
}

describe('alfred profile overlapping connect actions', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    vi.stubGlobal('window', {
      api: { alfredProfiles: alfredProfilesApi }
    })
  })

  it('keeps the later sign-in and one success toast when both waits complete', async () => {
    const laterCloud = { ...connectedCloud, userId: 'user-2', email: 'ada@example.com' }
    const laterAuthStatus: AlfredProfileAuthStatus = {
      ...connectedAuthStatus,
      cloud: laterCloud
    }
    const earlierConnected: ConnectCurrentAlfredProfileResult = {
      status: 'connected',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [{ ...listState.profiles[0], kind: 'cloud-linked', cloud: connectedCloud }]
    }
    const laterConnected: ConnectCurrentAlfredProfileResult = {
      status: 'connected',
      auth: laterAuthStatus,
      activeProfileId: 'local-default',
      profiles: [{ ...listState.profiles[0], kind: 'cloud-linked', cloud: laterCloud }]
    }
    let finishFirst!: (value: ConnectCurrentAlfredProfileResult) => void
    alfredProfilesApi.connectCurrent
      .mockReturnValueOnce(
        new Promise<ConnectCurrentAlfredProfileResult>((resolve) => {
          finishFirst = resolve
        })
      )
      .mockResolvedValueOnce(laterConnected)
    const store = createTestStore()

    const first = store.getState().connectCurrentAlfredProfile()
    const second = store.getState().connectCurrentAlfredProfile()
    await expect(second).resolves.toEqual(laterConnected)
    finishFirst(earlierConnected)
    await expect(first).resolves.toEqual(earlierConnected)
    expect(toastSuccessMock).toHaveBeenCalledOnce()
    expect(toastErrorMock).not.toHaveBeenCalled()
    expect(store.getState().alfredProfileAuthStatus).toEqual(laterAuthStatus)
    expect(store.getState().alfredProfiles).toEqual(laterConnected.profiles)
  })

  it('ignores an in-flight later connect after sign-out', async () => {
    const signedOutAuth: AlfredProfileAuthStatus = {
      activeProfileId: 'local-default',
      configured: true,
      state: 'local',
      persistence: 'none'
    }
    const signedOut: SignOutCurrentAlfredProfileResult = {
      status: 'signed-out',
      auth: signedOutAuth,
      activeProfileId: 'local-default',
      profiles: listState.profiles
    }
    const earlierConnected: ConnectCurrentAlfredProfileResult = {
      status: 'connected',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [{ ...listState.profiles[0], kind: 'cloud-linked', cloud: connectedCloud }]
    }
    const laterConnected: ConnectCurrentAlfredProfileResult = {
      status: 'connected',
      auth: {
        ...connectedAuthStatus,
        cloud: { ...connectedCloud, userId: 'user-2', email: 'ada@example.com' }
      },
      activeProfileId: 'local-default',
      profiles: [
        {
          ...listState.profiles[0],
          kind: 'cloud-linked',
          cloud: { ...connectedCloud, userId: 'user-2', email: 'ada@example.com' }
        }
      ]
    }
    let finishLater!: (value: ConnectCurrentAlfredProfileResult) => void
    alfredProfilesApi.connectCurrent.mockResolvedValueOnce(earlierConnected).mockReturnValueOnce(
      new Promise<ConnectCurrentAlfredProfileResult>((resolve) => {
        finishLater = resolve
      })
    )
    alfredProfilesApi.signOutCurrent.mockResolvedValue(signedOut)
    const store = createTestStore()

    const earlier = store.getState().connectCurrentAlfredProfile()
    const later = store.getState().connectCurrentAlfredProfile()
    await expect(earlier).resolves.toEqual(earlierConnected)
    await expect(store.getState().signOutCurrentAlfredProfile()).resolves.toEqual(signedOut)
    finishLater(laterConnected)
    await expect(later).resolves.toEqual(laterConnected)
    expect(store.getState().alfredProfileAuthStatus).toEqual(signedOutAuth)
    expect(store.getState().alfredProfiles).toEqual(listState.profiles)
  })

  it('does not toast signed out when sign-out returns an already-relinked session', async () => {
    const signedOut: SignOutCurrentAlfredProfileResult = {
      status: 'signed-out',
      auth: connectedAuthStatus,
      activeProfileId: 'local-default',
      profiles: [{ ...listState.profiles[0], kind: 'cloud-linked', cloud: connectedCloud }]
    }
    alfredProfilesApi.signOutCurrent.mockResolvedValue(signedOut)
    const store = createTestStore()

    await expect(store.getState().signOutCurrentAlfredProfile()).resolves.toEqual(signedOut)
    expect(toastSuccessMock).not.toHaveBeenCalled()
    expect(store.getState().alfredProfileAuthStatus).toEqual(connectedAuthStatus)
  })
})
