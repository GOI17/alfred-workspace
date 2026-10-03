import type {
  AlfredProfileOrgInviteRevokeArgs,
  AlfredProfileOrgMemberChangeRoleArgs,
  AlfredProfileOrgMemberInviteArgs,
  AlfredProfileOrgMemberMutationResult,
  AlfredProfileOrgMemberRemoveArgs,
  AlfredProfileOrgMembersListResult
} from '../../shared/alfred-profiles'
import type { ActiveAlfredProfileState } from './profile-index-store'
import { ensureActiveAlfredProfile } from './profile-index-store'
import type { AlfredCloudAuthConfig } from './profile-cloud-auth-config'
import { getAlfredCloudAuthConfig, isAlfredCloudDevAuthEnabled } from './profile-cloud-auth-config'
import type { AlfredCloudSession } from './profile-cloud-session-store'
import { AlfredCloudRequestError } from './profile-cloud-client'
import { runWithFreshAlfredCloudSession } from './profile-cloud-session-refresh'
import {
  changeAlfredCloudOrgMemberRole,
  inviteAlfredCloudOrgMember,
  listAlfredCloudOrgMembers,
  removeAlfredCloudOrgMember,
  revokeAlfredCloudOrgInvite
} from './profile-cloud-org-members-client'
import {
  changeDevAlfredCloudOrgMemberRole,
  inviteDevAlfredCloudOrgMember,
  listDevAlfredCloudOrgMembers,
  removeDevAlfredCloudOrgMember,
  revokeDevAlfredCloudOrgInvite
} from './profile-cloud-dev-org-members'

type OrgCallResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'reconnect-required' }
  | { status: 'request-error'; error: AlfredCloudRequestError }
  | { status: 'failed'; error: string }

// Why: only a 401 means the token itself is stale and should drive a session
// refresh/reconnect. 403/404/409/400 are business or permission outcomes the UI
// must interpret, so they are surfaced as values rather than thrown — otherwise
// runWithFreshAlfredCloudSession would treat a 403 as an auth failure and burn a
// pointless token refresh + retry before giving up.
async function runOrgMemberCall<T>(
  config: AlfredCloudAuthConfig,
  active: ActiveAlfredProfileState,
  userDataPath: string,
  call: (session: AlfredCloudSession) => Promise<T>
): Promise<OrgCallResult<T>> {
  try {
    const operation = await runWithFreshAlfredCloudSession(
      config,
      active,
      userDataPath,
      async (session) => {
        try {
          return { ok: true as const, value: await call(session) }
        } catch (error) {
          if (error instanceof AlfredCloudRequestError && error.statusCode !== 401) {
            return { ok: false as const, error }
          }
          throw error
        }
      }
    )
    if (operation.status !== 'ok') {
      return { status: 'reconnect-required' }
    }
    const outcome = operation.value
    return outcome.ok
      ? { status: 'ok', value: outcome.value }
      : { status: 'request-error', error: outcome.error }
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : String(error) }
  }
}

function mapMutationRequestError(
  error: AlfredCloudRequestError
): AlfredProfileOrgMemberMutationResult {
  switch (error.statusCode) {
    case 403:
      return { status: 'forbidden' }
    case 404:
      return { status: 'not-found' }
    case 409:
      return {
        status: 'conflict',
        reason: error.errorCode === 'already_member' ? 'already_member' : 'already_invited'
      }
    case 400:
      return {
        status: 'invalid',
        reason:
          error.errorCode === 'cannot_remove_self' ? 'cannot_remove_self' : 'cannot_change_own_role'
      }
    default:
      return { status: 'failed', error: error.message }
  }
}

function mapMutationResult(result: OrgCallResult<void>): AlfredProfileOrgMemberMutationResult {
  switch (result.status) {
    case 'ok':
      return { status: 'ok' }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return mapMutationRequestError(result.error)
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function listAlfredProfileOrgMembers(
  userDataPath: string,
  orgId: string
): Promise<AlfredProfileOrgMembersListResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    return { status: 'ok', roster: listDevAlfredCloudOrgMembers(orgId) }
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  const result = await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
    listAlfredCloudOrgMembers(configState.config, session, orgId)
  )
  switch (result.status) {
    case 'ok':
      return { status: 'ok', roster: result.value }
    case 'reconnect-required':
      return { status: 'reconnect-required' }
    case 'request-error':
      return { status: 'failed', error: result.error.message }
    case 'failed':
      return { status: 'failed', error: result.error }
  }
}

export async function inviteAlfredProfileOrgMember(
  userDataPath: string,
  args: AlfredProfileOrgMemberInviteArgs
): Promise<AlfredProfileOrgMemberMutationResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    return inviteDevAlfredCloudOrgMember(args)
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      inviteAlfredCloudOrgMember(configState.config, session, args)
    )
  )
}

export async function revokeAlfredProfileOrgInvite(
  userDataPath: string,
  args: AlfredProfileOrgInviteRevokeArgs
): Promise<AlfredProfileOrgMemberMutationResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    return revokeDevAlfredCloudOrgInvite(args)
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      revokeAlfredCloudOrgInvite(configState.config, session, args)
    )
  )
}

export async function changeAlfredProfileOrgMemberRole(
  userDataPath: string,
  args: AlfredProfileOrgMemberChangeRoleArgs
): Promise<AlfredProfileOrgMemberMutationResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    return changeDevAlfredCloudOrgMemberRole(args)
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      changeAlfredCloudOrgMemberRole(configState.config, session, args)
    )
  )
}

export async function removeAlfredProfileOrgMember(
  userDataPath: string,
  args: AlfredProfileOrgMemberRemoveArgs
): Promise<AlfredProfileOrgMemberMutationResult> {
  const active = ensureActiveAlfredProfile(userDataPath)
  if (isAlfredCloudDevAuthEnabled()) {
    return removeDevAlfredCloudOrgMember(args)
  }
  const configState = getAlfredCloudAuthConfig()
  if (!configState.configured) {
    return { status: 'unconfigured' }
  }
  return mapMutationResult(
    await runOrgMemberCall(configState.config, active, userDataPath, (session) =>
      removeAlfredCloudOrgMember(configState.config, session, args)
    )
  )
}
