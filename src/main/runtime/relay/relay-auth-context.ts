import type { AlfredCloudAuthConfig } from '../../alfred-profiles/profile-cloud-auth-config'
import { ensureActiveAlfredProfile } from '../../alfred-profiles/profile-index-store'
import { readFreshAlfredCloudSession } from '../../alfred-profiles/profile-cloud-session-refresh'
import type { RelayAuthContext } from './relay-auth-coordinator'

export async function readRelayAuthContext(
  authConfig: AlfredCloudAuthConfig,
  userDataPath: string
): Promise<RelayAuthContext | null> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (!active.profile.cloud) {
    return null
  }
  const session = await readFreshAlfredCloudSession(authConfig, active, userDataPath)
  if (session.status !== 'found') {
    return null
  }
  // Why: refresh and org-selection can rewrite cloud linkage while the request
  // is in flight; identity must come from the post-refresh profile state.
  const refreshed = ensureActiveAlfredProfile(userDataPath)
  const cloud = refreshed.profile.cloud
  if (!cloud || refreshed.profile.id !== active.profile.id) {
    return null
  }
  return {
    identity: {
      userId: cloud.userId,
      profileId: cloud.cloudProfileId,
      organizationId: cloud.activeOrgId ?? ''
    },
    accessToken: session.session.accessToken,
    relayEntitled: session.session.capabilities.flags['relay.use'] === true
  }
}
