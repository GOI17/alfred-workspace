import { getDefaultSettings } from '../../shared/constants'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  createCloudLinkedAlfredProfileMock,
  connectCurrentAlfredProfileMock,
  getCurrentAlfredProfileAuthStatusMock,
  refreshCurrentAlfredProfileAuthMock,
  selectCurrentAlfredProfileOrgMock,
  signOutCurrentAlfredProfileMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  createCloudLinkedAlfredProfileMock: vi.fn(),
  connectCurrentAlfredProfileMock: vi.fn(),
  getCurrentAlfredProfileAuthStatusMock: vi.fn(),
  refreshCurrentAlfredProfileAuthMock: vi.fn(),
  selectCurrentAlfredProfileOrgMock: vi.fn(),
  signOutCurrentAlfredProfileMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: vi.fn(),
    relaunch: vi.fn()
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: vi.fn()
}))

vi.mock('../alfred-profiles/profile-index-store', () => ({
  createLocalAlfredProfile: vi.fn(),
  getAlfredProfileListState: vi.fn(),
  seedNewAlfredProfileTelemetryConsent: vi.fn(),
  setActiveAlfredProfile: vi.fn()
}))

vi.mock('../alfred-profiles/profile-project-transfer', () => ({
  transferAlfredProfileProject: vi.fn()
}))

vi.mock('../alfred-profiles/profile-cloud-service', () => ({
  createCloudLinkedAlfredProfile: createCloudLinkedAlfredProfileMock,
  connectCurrentAlfredProfile: connectCurrentAlfredProfileMock,
  getCurrentAlfredProfileAuthStatus: getCurrentAlfredProfileAuthStatusMock,
  refreshCurrentAlfredProfileAuth: refreshCurrentAlfredProfileAuthMock,
  selectCurrentAlfredProfileOrg: selectCurrentAlfredProfileOrgMock,
  signOutCurrentAlfredProfile: signOutCurrentAlfredProfileMock
}))

import { registerAlfredProfileHandlers } from './alfred-profiles'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

describe('registerAlfredProfileHandlers auth channels', () => {
  beforeEach(() => {
    // Why the port and per-test: userData resolves through AppEnvironment now, and
    // the global setup's beforeEach reinstates its own fake before this runs.
    installFakeAppEnvironment({ getPath: () => '/tmp/alfred-user-data' })
    handlers.clear()
    createCloudLinkedAlfredProfileMock.mockReset()
    connectCurrentAlfredProfileMock.mockReset()
    getCurrentAlfredProfileAuthStatusMock.mockReset()
    refreshCurrentAlfredProfileAuthMock.mockReset()
    selectCurrentAlfredProfileOrgMock.mockReset()
    signOutCurrentAlfredProfileMock.mockReset()
  })

  it('returns auth status for the current profile', async () => {
    const status = {
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    }
    getCurrentAlfredProfileAuthStatusMock.mockReturnValue(status)
    registerAlfredProfileHandlers({
      flushPendingOrThrowAsync: vi.fn(async () => {}),
      freezeWrites: vi.fn(),
      getSettings: () => getDefaultSettings('/tmp')
    })

    await expect(Promise.resolve(handlers.get('alfredProfiles:authStatus')?.(null))).resolves.toBe(
      status
    )
    expect(getCurrentAlfredProfileAuthStatusMock).toHaveBeenCalledWith('/tmp/alfred-user-data')
  })

  it('connects and signs out the current profile through the cloud service', async () => {
    const connectResult = { status: 'unconfigured', auth: { activeProfileId: 'local-default' } }
    const signOutResult = { status: 'signed-out', auth: { activeProfileId: 'local-default' } }
    connectCurrentAlfredProfileMock.mockResolvedValue(connectResult)
    signOutCurrentAlfredProfileMock.mockResolvedValue(signOutResult)
    registerAlfredProfileHandlers({
      flushPendingOrThrowAsync: vi.fn(async () => {}),
      freezeWrites: vi.fn(),
      getSettings: () => getDefaultSettings('/tmp')
    })

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:connectCurrent')?.(null))
    ).resolves.toBe(connectResult)
    await expect(
      Promise.resolve(handlers.get('alfredProfiles:signOutCurrent')?.(null))
    ).resolves.toBe(signOutResult)
    expect(connectCurrentAlfredProfileMock).toHaveBeenCalledWith('/tmp/alfred-user-data')
    expect(signOutCurrentAlfredProfileMock).toHaveBeenCalledWith('/tmp/alfred-user-data')
  })

  it('refreshes profile auth through the cloud service', async () => {
    const refreshResult = { status: 'refreshed', auth: { activeProfileId: 'local-default' } }
    refreshCurrentAlfredProfileAuthMock.mockResolvedValue(refreshResult)
    registerAlfredProfileHandlers({
      flushPendingOrThrowAsync: vi.fn(async () => {}),
      freezeWrites: vi.fn(),
      getSettings: () => getDefaultSettings('/tmp')
    })

    await expect(Promise.resolve(handlers.get('alfredProfiles:refreshAuth')?.(null))).resolves.toBe(
      refreshResult
    )
    expect(refreshCurrentAlfredProfileAuthMock).toHaveBeenCalledWith('/tmp/alfred-user-data')
  })

  it('validates organization selection before calling the cloud service', async () => {
    const selectResult = { status: 'selected', auth: { activeProfileId: 'local-default' } }
    selectCurrentAlfredProfileOrgMock.mockResolvedValue(selectResult)
    registerAlfredProfileHandlers({
      flushPendingOrThrowAsync: vi.fn(async () => {}),
      freezeWrites: vi.fn(),
      getSettings: () => getDefaultSettings('/tmp')
    })

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:selectOrg')?.(null, { orgId: ' org-1 ' }))
    ).resolves.toBe(selectResult)
    expect(selectCurrentAlfredProfileOrgMock).toHaveBeenCalledWith('/tmp/alfred-user-data', 'org-1')

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:selectOrg')?.(null, { orgId: ' ' }))
    ).rejects.toThrow('invalid_alfred_profile_org_selection')
  })

  it('creates cloud-linked profiles with trimmed optional args', async () => {
    const createResult = {
      status: 'created',
      auth: { activeProfileId: 'local-default' },
      activeProfileId: 'local-default',
      profiles: [],
      profile: { id: 'cloud-1' }
    }
    createCloudLinkedAlfredProfileMock.mockResolvedValue(createResult)
    registerAlfredProfileHandlers({
      flushPendingOrThrowAsync: vi.fn(async () => {}),
      freezeWrites: vi.fn(),
      getSettings: () => getDefaultSettings('/tmp')
    })

    await expect(
      Promise.resolve(
        handlers.get('alfredProfiles:createCloudLinked')?.(null, {
          orgId: ' org-1 ',
          name: ' Acme '
        })
      )
    ).resolves.toBe(createResult)
    expect(createCloudLinkedAlfredProfileMock).toHaveBeenCalledWith('/tmp/alfred-user-data', {
      orgId: 'org-1',
      name: 'Acme'
    })
  })
})
