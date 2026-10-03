import { isJsonObject } from '../../shared/json-object'
import { app, ipcMain } from 'electron'
import type { Store } from '../persistence'
import { relaunchApp, type AppRelaunchReason } from '../app-relaunch'
import type {
  CreateLocalAlfredProfileArgs,
  CreateLocalAlfredProfileResult,
  CreateCloudLinkedAlfredProfileArgs,
  CreateCloudLinkedAlfredProfileResult,
  FindAlfredProfileProjectsByPathArgs,
  FindAlfredProfileProjectsByPathResult,
  AlfredProfileListResult,
  RefreshCurrentAlfredProfileAuthResult,
  SwitchAlfredProfileArgs,
  SwitchAlfredProfileResult,
  TransferAlfredProfileProjectArgs,
  TransferAlfredProfileProjectResult,
  ConnectCurrentAlfredProfileResult,
  AlfredProfileAuthStatus,
  SelectAlfredProfileOrgArgs,
  SelectAlfredProfileOrgResult,
  SignOutCurrentAlfredProfileResult
} from '../../shared/alfred-profiles'
import {
  createLocalAlfredProfile,
  getAlfredProfileListState,
  seedNewAlfredProfileTelemetryConsent,
  setActiveAlfredProfile
} from '../alfred-profiles/profile-index-store'
import {
  cloudSessionIdentity,
  recordCloudSessionIdentityMutation
} from '../alfred-profiles/profile-cloud-session-mutation'
import { getProfileUserDataPath } from '../alfred-profiles/profile-storage-paths'
import { isMultiProfileUiEnabled } from '../alfred-profiles/profile-ui-scope'
import { transferAlfredProfileProject } from '../alfred-profiles/profile-project-transfer'
import { findAlfredProfileProjectsByPath } from '../alfred-profiles/profile-project-presence'
import { flushActiveProfileBeforeFileMutation } from '../alfred-profiles/profile-persistence-deadline'
import { normalizeExecutionHostId } from '../../shared/execution-host'
import {
  createCloudLinkedAlfredProfile,
  connectCurrentAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  refreshCurrentAlfredProfileAuth,
  selectCurrentAlfredProfileOrg,
  signOutCurrentAlfredProfile
} from '../alfred-profiles/profile-cloud-service'
import { registerAlfredProfileOrgMemberHandlers } from './alfred-profile-org-members-handlers'
import { onAlfredCloudSessionInvalidated } from '../alfred-profiles/profile-cloud-session-invalidation'
import { broadcastAlfredProfileAuthStatusChanged } from './alfred-profile-auth-status-broadcast'

type RegisterAlfredProfileHandlersOptions = {
  onBeforeRelaunch?: () => void | Promise<void>
  onAuthMutation?: () => void
  onBeforeSignOut?: () => void
}

function profileIdFromArgs(args: unknown): string {
  if (!isJsonObject(args) || typeof args.profileId !== 'string') {
    throw new Error('invalid_alfred_profile_id')
  }
  const profileId = args.profileId.trim()
  if (!profileId) {
    throw new Error('invalid_alfred_profile_id')
  }
  return profileId
}

function transferProjectArgsFromUnknown(args: unknown): TransferAlfredProfileProjectArgs {
  if (!isJsonObject(args)) {
    throw new Error('invalid_alfred_profile_project_transfer')
  }
  const candidate = args
  const sourceProfileId =
    typeof candidate.sourceProfileId === 'string' ? candidate.sourceProfileId.trim() : ''
  const targetProfileId =
    typeof candidate.targetProfileId === 'string' ? candidate.targetProfileId.trim() : ''
  const repoId = typeof candidate.repoId === 'string' ? candidate.repoId.trim() : ''
  const mode = candidate.mode
  if (!sourceProfileId || !targetProfileId || !repoId || (mode !== 'move' && mode !== 'copy')) {
    throw new Error('invalid_alfred_profile_project_transfer')
  }
  return {
    sourceProfileId,
    targetProfileId,
    repoId,
    mode
  }
}

function findProjectsByPathArgsFromUnknown(args: unknown): FindAlfredProfileProjectsByPathArgs {
  if (!isJsonObject(args)) {
    throw new Error('invalid_alfred_profile_project_path')
  }
  const candidate = args
  const path = typeof candidate.path === 'string' ? candidate.path.trim() : ''
  if (!path) {
    throw new Error('invalid_alfred_profile_project_path')
  }
  let executionHostId: FindAlfredProfileProjectsByPathArgs['executionHostId'] = null
  if (candidate.executionHostId !== null && candidate.executionHostId !== undefined) {
    if (typeof candidate.executionHostId !== 'string') {
      throw new Error('invalid_alfred_profile_project_path')
    }
    executionHostId = normalizeExecutionHostId(candidate.executionHostId)
    if (!executionHostId) {
      throw new Error('invalid_alfred_profile_project_path')
    }
  }
  return {
    path,
    connectionId:
      typeof candidate.connectionId === 'string' ? candidate.connectionId.trim() || null : null,
    executionHostId,
    excludeProfileId:
      typeof candidate.excludeProfileId === 'string'
        ? candidate.excludeProfileId.trim() || null
        : null
  }
}

function orgIdFromUnknown(args: unknown): string {
  if (!isJsonObject(args)) {
    throw new Error('invalid_alfred_profile_org_selection')
  }
  const orgId = typeof args.orgId === 'string' ? args.orgId.trim() : ''
  if (!orgId) {
    throw new Error('invalid_alfred_profile_org_selection')
  }
  return orgId
}

function createCloudLinkedProfileArgsFromUnknown(
  args: unknown
): CreateCloudLinkedAlfredProfileArgs {
  if (!isJsonObject(args)) {
    return {}
  }
  const candidate = args
  const orgId = typeof candidate.orgId === 'string' ? candidate.orgId.trim() : undefined
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : undefined
  return {
    ...(orgId ? { orgId } : {}),
    ...(name ? { name } : {})
  }
}

async function runBeforeProfileRelaunch(
  onBeforeRelaunch?: () => void | Promise<void>
): Promise<void> {
  try {
    await onBeforeRelaunch?.()
  } catch (error) {
    console.warn(
      '[alfred-profiles] Pre-relaunch cleanup failed; continuing profile switch:',
      error instanceof Error ? error.name : typeof error
    )
  }
}

function scheduleProfileRelaunch(reason: Extract<AppRelaunchReason, `profile-${string}`>): void {
  setTimeout(() => {
    relaunchApp(reason)
    // Why: app.quit() (not app.exit) so before-quit/will-quit still run —
    // renderer scrollback capture, PTY kill, stats flush, and daemon final
    // checkpoints must not be skipped on a profile switch.
    app.quit()
  }, 150)
}

export function registerAlfredProfileHandlers(
  store: Pick<Store, 'getSettings' | 'freezeWrites' | 'flushPendingOrThrowAsync'>,
  options: RegisterAlfredProfileHandlersOptions = {}
): void {
  ipcMain.handle('alfredProfiles:list', (): AlfredProfileListResult => ({
    ...getAlfredProfileListState(),
    multiProfileUi: isMultiProfileUiEnabled()
  }))

  ipcMain.handle('alfredProfiles:authStatus', (): AlfredProfileAuthStatus =>
    getCurrentAlfredProfileAuthStatus(getProfileUserDataPath())
  )

  // Why: a background refresh can revoke the session with no renderer request in
  // flight, so push the change instead of waiting for the next pane to ask.
  // Why not options.onAuthMutation: that hook drives the relay coordinator, which
  // is the caller that just failed the refresh — re-entering it here would be a loop.
  onAlfredCloudSessionInvalidated(broadcastAlfredProfileAuthStatusChanged)

  ipcMain.handle(
    'alfredProfiles:createLocal',
    (_event, args?: CreateLocalAlfredProfileArgs): CreateLocalAlfredProfileResult => {
      const result = createLocalAlfredProfile(args)
      seedNewAlfredProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
      return result
    }
  )

  ipcMain.handle(
    'alfredProfiles:switch',
    async (_event, args: SwitchAlfredProfileArgs): Promise<SwitchAlfredProfileResult> => {
      const profileId = profileIdFromArgs(args)
      const current = getAlfredProfileListState()
      if (profileId === current.activeProfileId) {
        return { status: 'already-active' }
      }

      const activeProfile = current.profiles.find(
        (profile) => profile.id === current.activeProfileId
      )
      if (activeProfile?.cloud) {
        // Why: profile selection changes the expected identity synchronously;
        // stale refresh saves must fail even before relaunch teardown finishes.
        recordCloudSessionIdentityMutation(
          cloudSessionIdentity(activeProfile.id, activeProfile.cloud),
          getProfileUserDataPath()
        )
      }
      // Why: the current profile must be persisted before the global index
      // points startup at the target profile.
      await flushActiveProfileBeforeFileMutation(store)
      await runBeforeProfileRelaunch(options.onBeforeRelaunch)
      setActiveAlfredProfile(profileId)

      scheduleProfileRelaunch('profile-switch')

      return { status: 'relaunching' }
    }
  )

  ipcMain.handle(
    'alfredProfiles:transferProject',
    async (
      _event,
      rawArgs: TransferAlfredProfileProjectArgs
    ): Promise<TransferAlfredProfileProjectResult> => {
      const args = transferProjectArgsFromUnknown(rawArgs)
      const current = getAlfredProfileListState()
      if (args.targetProfileId === current.activeProfileId) {
        throw new Error('active_target_alfred_profile_transfer_requires_relaunch')
      }
      if (args.mode === 'move' && args.sourceProfileId === current.activeProfileId) {
        // Why: transfer before any relaunch side effect so a duplicate-target
        // or validation failure cannot strand the app in a quitting state.
        await flushActiveProfileBeforeFileMutation(store)
        const result = transferAlfredProfileProject(args, getProfileUserDataPath())
        if (result.status === 'transferred') {
          store.freezeWrites()
          await runBeforeProfileRelaunch(options.onBeforeRelaunch)
          setActiveAlfredProfile(args.targetProfileId)
          scheduleProfileRelaunch('profile-transfer')
          return { ...result, willRelaunch: true }
        }
        return result
      }
      await flushActiveProfileBeforeFileMutation(store)
      return transferAlfredProfileProject(args, getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'alfredProfiles:findProjectProfiles',
    (_event, rawArgs: FindAlfredProfileProjectsByPathArgs): FindAlfredProfileProjectsByPathResult =>
      findAlfredProfileProjectsByPath(
        findProjectsByPathArgsFromUnknown(rawArgs),
        getProfileUserDataPath()
      )
  )

  ipcMain.handle(
    'alfredProfiles:connectCurrent',
    async (): Promise<ConnectCurrentAlfredProfileResult> => {
      const result = await connectCurrentAlfredProfile(getProfileUserDataPath())
      if (result.status === 'connected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'alfredProfiles:createCloudLinked',
    async (
      _event,
      rawArgs?: CreateCloudLinkedAlfredProfileArgs
    ): Promise<CreateCloudLinkedAlfredProfileResult> => {
      const result = await createCloudLinkedAlfredProfile(
        getProfileUserDataPath(),
        createCloudLinkedProfileArgsFromUnknown(rawArgs)
      )
      if (result.status === 'created') {
        seedNewAlfredProfileTelemetryConsent(result.profile.id, store.getSettings().telemetry)
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'alfredProfiles:refreshAuth',
    async (): Promise<RefreshCurrentAlfredProfileAuthResult> => {
      const result = await refreshCurrentAlfredProfileAuth(getProfileUserDataPath())
      if (result.status === 'refreshed') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  ipcMain.handle(
    'alfredProfiles:signOutCurrent',
    async (): Promise<SignOutCurrentAlfredProfileResult> => {
      options.onBeforeSignOut?.()
      return signOutCurrentAlfredProfile(getProfileUserDataPath())
    }
  )

  ipcMain.handle(
    'alfredProfiles:selectOrg',
    async (_event, rawArgs: SelectAlfredProfileOrgArgs): Promise<SelectAlfredProfileOrgResult> => {
      const result = await selectCurrentAlfredProfileOrg(
        getProfileUserDataPath(),
        orgIdFromUnknown(rawArgs)
      )
      if (result.status === 'selected') {
        options.onAuthMutation?.()
      }
      return result
    }
  )

  registerAlfredProfileOrgMemberHandlers()
}
