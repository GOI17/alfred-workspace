import type {
  ConnectCurrentAlfredProfileResult,
  CreateCloudLinkedAlfredProfileArgs,
  CreateCloudLinkedAlfredProfileResult,
  AlfredProfileAuthStatus,
  SelectAlfredProfileOrgResult,
  SignOutCurrentAlfredProfileResult
} from '../../shared/alfred-profiles'
import { ensureActiveAlfredProfile } from './profile-index-store'
import { getAlfredCloudAuthConfig, isAlfredCloudDevAuthEnabled } from './profile-cloud-auth-config'
import {
  clearAlfredCloudSession,
  readAlfredCloudSession,
  saveAlfredCloudSessionExchange
} from './profile-cloud-session-store'
import { cloudSessionIdentity, tombstoneCloudSession } from './profile-cloud-session-mutation'
import {
  createAlfredCloudProfile,
  exchangeAlfredCloudAuthCode,
  revokeAlfredCloudSession
} from './profile-cloud-client'
import { beginAlfredCloudPkceFlow } from './profile-cloud-pkce'
import {
  createCloudLinkedAlfredProfileRecord,
  linkAlfredProfileToCloud,
  unlinkAlfredProfileFromCloud
} from './profile-cloud-index'
import { runWithFreshAlfredCloudSession } from './profile-cloud-session-refresh'
import {
  connectDevAlfredCloudProfile,
  createDevCloudLinkedAlfredProfile,
  selectDevAlfredCloudOrg
} from './profile-cloud-dev-service'
import { getAlfredProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { selectCloudOrgWithMutationFence } from './profile-cloud-org-selection'

export { refreshCurrentAlfredProfileAuth } from './profile-cloud-capability-refresh'

let nextCloudConnectAttempt = 0
let linkedCloudConnectAttempt = 0

function invalidateOutstandingCloudConnectAttempts(): void {
  nextCloudConnectAttempt += 1
  linkedCloudConnectAttempt = nextCloudConnectAttempt
}

function isUserCancelledAuthError(message: string): boolean {
  return message === 'alfred_cloud_auth_timeout' || message === 'alfred_cloud_auth_denied'
}

function activeAuth(
  active: ReturnType<typeof ensureActiveAlfredProfile>,
  userDataPath: string
): AlfredProfileAuthStatus {
  return getAlfredProfileAuthStatusFromProfile(active, userDataPath)
}

export function getCurrentAlfredProfileAuthStatus(userDataPath: string): AlfredProfileAuthStatus {
  return getAlfredProfileAuthStatusFromProfile(
    ensureActiveAlfredProfile(userDataPath),
    userDataPath
  )
}

export async function connectCurrentAlfredProfile(
  userDataPath: string
): Promise<ConnectCurrentAlfredProfileResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    const list = connectDevAlfredCloudProfile(active, userDataPath)
    return {
      status: 'connected',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  }

  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return {
      status: 'unconfigured',
      auth: activeAuth(active, userDataPath)
    }
  }

  const attempt = ++nextCloudConnectAttempt
  try {
    const code = await beginAlfredCloudPkceFlow(configState.config, active.profile.id)
    if (attempt < linkedCloudConnectAttempt) {
      return {
        status: 'cancelled',
        auth: getCurrentAlfredProfileAuthStatus(userDataPath)
      }
    }
    const exchange = await exchangeAlfredCloudAuthCode(configState.config, {
      ...code,
      localProfileId: active.profile.id
    })
    if (attempt < linkedCloudConnectAttempt) {
      return {
        status: 'cancelled',
        auth: getCurrentAlfredProfileAuthStatus(userDataPath)
      }
    }
    saveAlfredCloudSessionExchange(active.profile.id, userDataPath, exchange)
    const list = linkAlfredProfileToCloud(active.profile.id, exchange.cloud, userDataPath)
    linkedCloudConnectAttempt = attempt
    return {
      status: 'connected',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (isUserCancelledAuthError(message)) {
      return {
        status: 'cancelled',
        auth: getCurrentAlfredProfileAuthStatus(userDataPath)
      }
    }
    return {
      status: 'failed',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      error: message
    }
  }
}

export async function signOutCurrentAlfredProfile(
  userDataPath: string
): Promise<SignOutCurrentAlfredProfileResult> {
  // Why: a Sign in click still waiting in the browser must not relink after
  // the user explicitly signed out.
  invalidateOutstandingCloudConnectAttempts()
  const signOutEpoch = linkedCloudConnectAttempt
  const active = ensureActiveAlfredProfile(userDataPath)
  const configState = getAlfredCloudAuthConfig()
  const session = readAlfredCloudSession(active.profile.id, userDataPath)
  if (active.profile.cloud) {
    // Why: persist the destructive fence before logout network I/O so a
    // refresh already in flight cannot save after explicit sign-out.
    tombstoneCloudSession(
      cloudSessionIdentity(active.profile.id, active.profile.cloud),
      userDataPath
    )
  }
  if (!isAlfredCloudDevAuthEnabled() && configState.configured && session.status === 'found') {
    await revokeAlfredCloudSession(configState.config, session.session).catch(() => undefined)
  }
  if (linkedCloudConnectAttempt > signOutEpoch) {
    const current = ensureActiveAlfredProfile(userDataPath)
    return {
      status: 'signed-out',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: current.index.activeProfileId,
      profiles: current.index.profiles
    }
  }
  clearAlfredCloudSession(active.profile.id, userDataPath)
  const list = unlinkAlfredProfileFromCloud(active.profile.id, userDataPath)
  return {
    status: 'signed-out',
    auth: getCurrentAlfredProfileAuthStatus(userDataPath),
    activeProfileId: list.activeProfileId,
    profiles: list.profiles
  }
}

export async function createCloudLinkedAlfredProfile(
  userDataPath: string,
  args: CreateCloudLinkedAlfredProfileArgs
): Promise<CreateCloudLinkedAlfredProfileResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    const result = createDevCloudLinkedAlfredProfile(active, userDataPath, args)
    if (result.status !== 'created') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'created',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles,
      profile: result.list.profile
    }
  }

  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const operation = await runWithFreshAlfredCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => createAlfredCloudProfile(configState.config, session, args)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    const created = operation.value
    const list = createCloudLinkedAlfredProfileRecord(
      created.cloud,
      { name: args.name },
      userDataPath
    )
    saveAlfredCloudSessionExchange(list.profile.id, userDataPath, created)
    return {
      status: 'created',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles,
      profile: list.profile
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export async function selectCurrentAlfredProfileOrg(
  userDataPath: string,
  orgId: string
): Promise<SelectAlfredProfileOrgResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    const result = selectDevAlfredCloudOrg(active, userDataPath, orgId)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }

  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: activeAuth(active, userDataPath) }
  }
  try {
    const list = await selectCloudOrgWithMutationFence({
      config: configState.config,
      active,
      userDataPath,
      orgId
    })
    if (!list) {
      return { status: 'reconnect-required', auth: activeAuth(active, userDataPath) }
    }
    return {
      status: 'selected',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: getCurrentAlfredProfileAuthStatus(userDataPath),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
