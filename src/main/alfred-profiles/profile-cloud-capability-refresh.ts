import type { RefreshCurrentAlfredProfileAuthResult } from '../../shared/alfred-profiles'
import { getAlfredCloudAuthConfig, isAlfredCloudDevAuthEnabled } from './profile-cloud-auth-config'
import { getAlfredProfileAuthStatusFromProfile } from './profile-cloud-auth-status'
import { refreshAlfredCloudCapabilities } from './profile-cloud-client'
import { linkAlfredProfileToCloud } from './profile-cloud-index'
import { ensureActiveAlfredProfile, getAlfredProfileListState } from './profile-index-store'
import { refreshDevAlfredCloudProfile } from './profile-cloud-dev-service'
import {
  captureCloudSessionMutation,
  cloudSessionIdentity,
  recordCloudSessionIdentityMutationIfCurrent
} from './profile-cloud-session-mutation'
import { runWithFreshAlfredCloudSession } from './profile-cloud-session-refresh'
import {
  readAlfredCloudSession,
  saveAlfredCloudSessionIfCurrent
} from './profile-cloud-session-store'

export async function refreshCurrentAlfredProfileAuth(
  userDataPath: string
): Promise<RefreshCurrentAlfredProfileAuthResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  const auth = () => getAlfredProfileAuthStatusFromProfile(active, userDataPath)
  if (!active.profile.cloud) {
    return { status: 'local', auth: auth() }
  }
  if (isAlfredCloudDevAuthEnabled()) {
    const result = refreshDevAlfredCloudProfile(active, userDataPath)
    if (result.status !== 'updated') {
      return { status: 'reconnect-required', auth: auth() }
    }
    return {
      status: 'refreshed',
      auth: auth(),
      activeProfileId: result.list.activeProfileId,
      profiles: result.list.profiles
    }
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured', auth: auth() }
  }
  try {
    const identity = cloudSessionIdentity(active.profile.id, active.profile.cloud)
    let mutationSnapshot = captureCloudSessionMutation(identity, userDataPath)
    const operation = await runWithFreshAlfredCloudSession(
      configState.config,
      active,
      userDataPath,
      (session) => refreshAlfredCloudCapabilities(configState.config, session)
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required', auth: auth() }
    }
    const refresh = operation.value
    if (refresh.cloud) {
      const refreshedIdentity = cloudSessionIdentity(active.profile.id, refresh.cloud)
      if (
        refreshedIdentity.cloudUserId !== identity.cloudUserId ||
        refreshedIdentity.cloudProfileId !== identity.cloudProfileId
      ) {
        throw new Error('alfred_cloud_identity_changed_during_capability_refresh')
      }
      if (refreshedIdentity.organizationId !== identity.organizationId) {
        const advanced = recordCloudSessionIdentityMutationIfCurrent(
          refreshedIdentity,
          userDataPath,
          mutationSnapshot
        )
        if (!advanced) {
          return { status: 'reconnect-required', auth: auth() }
        }
        mutationSnapshot = advanced
      }
    }
    const session = readAlfredCloudSession(active.profile.id, userDataPath)
    if (session.status !== 'found') {
      return { status: 'reconnect-required', auth: auth() }
    }
    if (
      saveAlfredCloudSessionIfCurrent(
        active.profile.id,
        userDataPath,
        {
          ...session.session,
          organizations: refresh.organizations ?? session.session.organizations,
          capabilities: refresh.capabilities
        },
        mutationSnapshot
      ) === null
    ) {
      return { status: 'reconnect-required', auth: auth() }
    }
    const list = refresh.cloud
      ? linkAlfredProfileToCloud(active.profile.id, refresh.cloud, userDataPath)
      : getAlfredProfileListState(userDataPath)
    return {
      status: 'refreshed',
      auth: getAlfredProfileAuthStatusFromProfile(
        ensureActiveAlfredProfile(userDataPath),
        userDataPath
      ),
      activeProfileId: list.activeProfileId,
      profiles: list.profiles
    }
  } catch (error) {
    return {
      status: 'failed',
      auth: auth(),
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
