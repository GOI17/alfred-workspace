import { getDefaultSettings } from '../../shared/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  appExitMock,
  appQuitMock,
  appRelaunchMock,
  relaunchAppMock,
  destroySystemTrayMock,
  createLocalAlfredProfileMock,
  getAlfredProfileListStateMock,
  seedNewAlfredProfileTelemetryConsentMock,
  setActiveAlfredProfileMock,
  transferAlfredProfileProjectMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  appExitMock: vi.fn(),
  appQuitMock: vi.fn(),
  appRelaunchMock: vi.fn(),
  relaunchAppMock: vi.fn(),
  destroySystemTrayMock: vi.fn(),
  createLocalAlfredProfileMock: vi.fn(),
  getAlfredProfileListStateMock: vi.fn(),
  seedNewAlfredProfileTelemetryConsentMock: vi.fn(),
  setActiveAlfredProfileMock: vi.fn(),
  transferAlfredProfileProjectMock: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    exit: appExitMock,
    quit: appQuitMock,
    relaunch: appRelaunchMock
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../tray/system-tray', () => ({
  destroySystemTray: destroySystemTrayMock
}))

vi.mock('../app-relaunch', () => ({
  relaunchApp: relaunchAppMock
}))

vi.mock('../alfred-profiles/profile-index-store', () => ({
  createLocalAlfredProfile: createLocalAlfredProfileMock,
  getAlfredProfileListState: getAlfredProfileListStateMock,
  seedNewAlfredProfileTelemetryConsent: seedNewAlfredProfileTelemetryConsentMock,
  setActiveAlfredProfile: setActiveAlfredProfileMock
}))

function makeStoreMock(flushPendingOrThrowAsync = vi.fn()) {
  return {
    flushPendingOrThrowAsync,
    freezeWrites: vi.fn(),
    getSettings: () => getDefaultSettings('/tmp')
  }
}

vi.mock('../alfred-profiles/profile-project-transfer', () => ({
  transferAlfredProfileProject: transferAlfredProfileProjectMock
}))

import { registerAlfredProfileHandlers } from './alfred-profiles'
import { installFakeAppEnvironment } from '../../../config/scripts/vitest-host-ports-setup'

describe('registerAlfredProfileHandlers', () => {
  beforeEach(() => {
    // Why the port and per-test: userData resolves through AppEnvironment now, and
    // the global setup's beforeEach reinstates its own fake before this runs.
    installFakeAppEnvironment({ getPath: () => '/tmp/alfred-user-data' })
    vi.useFakeTimers()
    handlers.clear()
    appExitMock.mockReset()
    appQuitMock.mockReset()
    appRelaunchMock.mockReset()
    relaunchAppMock.mockReset()
    relaunchAppMock.mockImplementation(() => appRelaunchMock())
    destroySystemTrayMock.mockReset()
    createLocalAlfredProfileMock.mockReset()
    getAlfredProfileListStateMock.mockReset()
    seedNewAlfredProfileTelemetryConsentMock.mockReset()
    setActiveAlfredProfileMock.mockReset()
    transferAlfredProfileProjectMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers list and create handlers', async () => {
    const listState = {
      activeProfileId: 'local-default',
      profiles: [{ id: 'local-default', name: 'Personal' }]
    }
    const createState = {
      ...listState,
      profile: { id: 'local-work', name: 'Work' }
    }
    getAlfredProfileListStateMock.mockReturnValue(listState)
    createLocalAlfredProfileMock.mockReturnValue(createState)

    registerAlfredProfileHandlers(makeStoreMock())

    await expect(Promise.resolve(handlers.get('alfredProfiles:list')?.(null))).resolves.toEqual({
      ...listState,
      multiProfileUi: false
    })
    await expect(
      Promise.resolve(handlers.get('alfredProfiles:createLocal')?.(null, { name: 'Work' }))
    ).resolves.toBe(createState)
    expect(createLocalAlfredProfileMock).toHaveBeenCalledWith({ name: 'Work' })
  })

  it('reports multiProfileUi when the env flag is set', async () => {
    const previous = process.env.ALFRED_MULTI_PROFILE_UI
    process.env.ALFRED_MULTI_PROFILE_UI = '1'
    try {
      getAlfredProfileListStateMock.mockReturnValue({
        activeProfileId: 'local-default',
        profiles: []
      })
      registerAlfredProfileHandlers(makeStoreMock())

      await expect(Promise.resolve(handlers.get('alfredProfiles:list')?.(null))).resolves.toEqual({
        activeProfileId: 'local-default',
        profiles: [],
        multiProfileUi: true
      })
    } finally {
      if (previous === undefined) {
        delete process.env.ALFRED_MULTI_PROFILE_UI
      } else {
        process.env.ALFRED_MULTI_PROFILE_UI = previous
      }
    }
  })

  it('marks the target profile active, flushes, and relaunches', async () => {
    const flush = vi.fn()
    const onBeforeRelaunch = vi.fn()
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    setActiveAlfredProfileMock.mockReturnValue({
      activeProfileId: 'local-work',
      profiles: []
    })
    registerAlfredProfileHandlers(makeStoreMock(flush), { onBeforeRelaunch })

    const resultPromise = Promise.resolve(
      handlers.get('alfredProfiles:switch')?.(null, { profileId: 'local-work' })
    )

    await expect(resultPromise).resolves.toEqual({ status: 'relaunching' })
    expect(setActiveAlfredProfileMock).toHaveBeenCalledWith('local-work')
    expect(flush).toHaveBeenCalledOnce()
    expect(onBeforeRelaunch).toHaveBeenCalledOnce()
    expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
      setActiveAlfredProfileMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    )
    expect(flush).toHaveBeenCalledBefore(onBeforeRelaunch)
    expect(appRelaunchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)

    expect(appRelaunchMock).toHaveBeenCalledOnce()
    expect(relaunchAppMock).toHaveBeenCalledWith('profile-switch')
    // Why quit, not exit: before-quit/will-quit teardown (scrollback capture,
    // PTY kill, daemon checkpoints) must run on a profile switch.
    expect(appQuitMock).toHaveBeenCalledOnce()
    expect(appExitMock).not.toHaveBeenCalled()
  })

  it('does not mark a profile active when current profile flush fails', async () => {
    const flush = vi.fn(() => {
      throw new Error('flush_failed')
    })
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    registerAlfredProfileHandlers(makeStoreMock(flush))

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:switch')?.(null, { profileId: 'local-work' }))
    ).rejects.toThrow('flush_failed')

    expect(setActiveAlfredProfileMock).not.toHaveBeenCalled()
    expect(appRelaunchMock).not.toHaveBeenCalled()
  })

  it('does not switch profiles when persistence cannot reach quiescence', async () => {
    const flush = vi.fn(() => new Promise<void>(() => {}))
    const onBeforeRelaunch = vi.fn()
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    registerAlfredProfileHandlers(makeStoreMock(flush), { onBeforeRelaunch })

    const switchProfile = Promise.resolve(
      handlers.get('alfredProfiles:switch')?.(null, { profileId: 'local-work' })
    )
    const rejection = expect(switchProfile).rejects.toThrow('alfred_profile_persistence_timeout')
    await vi.advanceTimersByTimeAsync(20_000)
    await rejection

    expect(setActiveAlfredProfileMock).not.toHaveBeenCalled()
    expect(appRelaunchMock).not.toHaveBeenCalled()
    expect(onBeforeRelaunch).not.toHaveBeenCalled()
  })

  it('does not relaunch when switching to the active profile', async () => {
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'local-default',
      profiles: []
    })
    registerAlfredProfileHandlers(makeStoreMock())

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:switch')?.(null, { profileId: 'local-default' }))
    ).resolves.toEqual({ status: 'already-active' })

    expect(setActiveAlfredProfileMock).not.toHaveBeenCalled()
    expect(appRelaunchMock).not.toHaveBeenCalled()
  })

  it('rejects invalid profile ids', async () => {
    registerAlfredProfileHandlers(makeStoreMock())

    await expect(
      Promise.resolve(handlers.get('alfredProfiles:switch')?.(null, { profileId: ' ' }))
    ).rejects.toThrow('invalid_alfred_profile_id')
  })

  it('transfers projects between inactive profiles after flushing active state', async () => {
    const flush = vi.fn()
    const result = {
      status: 'transferred',
      mode: 'copy',
      sourceProfileId: 'personal',
      targetProfileId: 'work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-2',
      targetProjectId: 'repo:repo-2'
    }
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'personal',
      profiles: []
    })
    transferAlfredProfileProjectMock.mockReturnValue(result)
    registerAlfredProfileHandlers(makeStoreMock(flush))

    await expect(
      Promise.resolve(
        handlers.get('alfredProfiles:transferProject')?.(null, {
          sourceProfileId: ' personal ',
          targetProfileId: ' work ',
          repoId: ' repo-1 ',
          mode: 'copy'
        })
      )
    ).resolves.toBe(result)

    expect(flush).toHaveBeenCalledOnce()
    expect(transferAlfredProfileProjectMock).toHaveBeenCalledWith(
      {
        sourceProfileId: 'personal',
        targetProfileId: 'work',
        repoId: 'repo-1',
        mode: 'copy'
      },
      '/tmp/alfred-user-data'
    )
  })

  it('moves a project out of the active profile and relaunches into the target profile', async () => {
    const flush = vi.fn()
    const onBeforeRelaunch = vi.fn()
    const result = {
      status: 'transferred',
      mode: 'move',
      sourceProfileId: 'personal',
      targetProfileId: 'work',
      sourceRepoId: 'repo-1',
      targetRepoId: 'repo-1',
      targetProjectId: 'repo:repo-1'
    }
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'personal',
      profiles: []
    })
    transferAlfredProfileProjectMock.mockReturnValue(result)
    registerAlfredProfileHandlers(makeStoreMock(flush), { onBeforeRelaunch })

    await expect(
      Promise.resolve(
        handlers.get('alfredProfiles:transferProject')?.(null, {
          sourceProfileId: 'personal',
          targetProfileId: 'work',
          repoId: 'repo-1',
          mode: 'move'
        })
      )
    ).resolves.toEqual({ ...result, willRelaunch: true })

    expect(onBeforeRelaunch).toHaveBeenCalledOnce()
    expect(flush).toHaveBeenCalledOnce()
    expect(transferAlfredProfileProjectMock).toHaveBeenCalledWith(
      {
        sourceProfileId: 'personal',
        targetProfileId: 'work',
        repoId: 'repo-1',
        mode: 'move'
      },
      '/tmp/alfred-user-data'
    )
    expect(setActiveAlfredProfileMock).toHaveBeenCalledWith('work')
    expect(appRelaunchMock).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(150)

    expect(appRelaunchMock).toHaveBeenCalledOnce()
    expect(relaunchAppMock).toHaveBeenCalledWith('profile-transfer')
    expect(appQuitMock).toHaveBeenCalledOnce()
    expect(appExitMock).not.toHaveBeenCalled()
  })

  it('rejects transfers that would mutate the active target profile offline', async () => {
    getAlfredProfileListStateMock.mockReturnValue({
      activeProfileId: 'work',
      profiles: []
    })
    registerAlfredProfileHandlers(makeStoreMock())

    await expect(
      Promise.resolve(
        handlers.get('alfredProfiles:transferProject')?.(null, {
          sourceProfileId: 'personal',
          targetProfileId: 'work',
          repoId: 'repo-1',
          mode: 'copy'
        })
      )
    ).rejects.toThrow('active_target_alfred_profile_transfer_requires_relaunch')

    expect(transferAlfredProfileProjectMock).not.toHaveBeenCalled()
  })
})
