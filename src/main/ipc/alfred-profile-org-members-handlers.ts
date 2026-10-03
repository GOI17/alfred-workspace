import { ipcMain } from 'electron'
import type {
  AlfredOrgRole,
  AlfredProfileOrgInviteRevokeArgs,
  AlfredProfileOrgMemberChangeRoleArgs,
  AlfredProfileOrgMemberInviteArgs,
  AlfredProfileOrgMemberMutationResult,
  AlfredProfileOrgMemberRemoveArgs,
  AlfredProfileOrgMembersListArgs,
  AlfredProfileOrgMembersListResult
} from '../../shared/alfred-profiles'
import { getProfileUserDataPath } from '../alfred-profiles/profile-storage-paths'
import {
  changeAlfredProfileOrgMemberRole,
  inviteAlfredProfileOrgMember,
  listAlfredProfileOrgMembers,
  removeAlfredProfileOrgMember,
  revokeAlfredProfileOrgInvite
} from '../alfred-profiles/profile-cloud-org-members-service'

function orgMembersScopedArgs(args: unknown): { orgId: string; record: Record<string, unknown> } {
  if (!args || typeof args !== 'object') {
    throw new Error('invalid_alfred_profile_org_selection')
  }
  const record = args as Record<string, unknown>
  const orgId = typeof record.orgId === 'string' ? record.orgId.trim() : ''
  if (!orgId) {
    throw new Error('invalid_alfred_profile_org_selection')
  }
  return { orgId, record }
}

function orgRoleFromUnknown(value: unknown): AlfredOrgRole {
  if (value === 'owner' || value === 'admin' || value === 'member') {
    return value
  }
  throw new Error('invalid_alfred_org_role')
}

function orgEmailFromUnknown(value: unknown): string {
  const email = typeof value === 'string' ? value.trim() : ''
  if (!email) {
    throw new Error('invalid_alfred_org_member_email')
  }
  return email
}

function orgUserIdFromUnknown(value: unknown): string {
  const userId = typeof value === 'string' ? value.trim() : ''
  if (!userId) {
    throw new Error('invalid_alfred_org_member_user')
  }
  return userId
}

function orgMemberInviteArgsFromUnknown(args: unknown): AlfredProfileOrgMemberInviteArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email), role: orgRoleFromUnknown(record.role) }
}

function orgInviteRevokeArgsFromUnknown(args: unknown): AlfredProfileOrgInviteRevokeArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, email: orgEmailFromUnknown(record.email) }
}

function orgMemberChangeRoleArgsFromUnknown(args: unknown): AlfredProfileOrgMemberChangeRoleArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return {
    orgId,
    userId: orgUserIdFromUnknown(record.userId),
    role: orgRoleFromUnknown(record.role)
  }
}

function orgMemberRemoveArgsFromUnknown(args: unknown): AlfredProfileOrgMemberRemoveArgs {
  const { orgId, record } = orgMembersScopedArgs(args)
  return { orgId, userId: orgUserIdFromUnknown(record.userId) }
}

export function registerAlfredProfileOrgMemberHandlers(): void {
  ipcMain.handle(
    'alfredProfiles:orgMembersList',
    async (
      _event,
      rawArgs: AlfredProfileOrgMembersListArgs
    ): Promise<AlfredProfileOrgMembersListResult> =>
      listAlfredProfileOrgMembers(getProfileUserDataPath(), orgMembersScopedArgs(rawArgs).orgId)
  )

  ipcMain.handle(
    'alfredProfiles:orgMemberInvite',
    async (
      _event,
      rawArgs: AlfredProfileOrgMemberInviteArgs
    ): Promise<AlfredProfileOrgMemberMutationResult> =>
      inviteAlfredProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberInviteArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'alfredProfiles:orgInviteRevoke',
    async (
      _event,
      rawArgs: AlfredProfileOrgInviteRevokeArgs
    ): Promise<AlfredProfileOrgMemberMutationResult> =>
      revokeAlfredProfileOrgInvite(
        getProfileUserDataPath(),
        orgInviteRevokeArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'alfredProfiles:orgMemberChangeRole',
    async (
      _event,
      rawArgs: AlfredProfileOrgMemberChangeRoleArgs
    ): Promise<AlfredProfileOrgMemberMutationResult> =>
      changeAlfredProfileOrgMemberRole(
        getProfileUserDataPath(),
        orgMemberChangeRoleArgsFromUnknown(rawArgs)
      )
  )

  ipcMain.handle(
    'alfredProfiles:orgMemberRemove',
    async (
      _event,
      rawArgs: AlfredProfileOrgMemberRemoveArgs
    ): Promise<AlfredProfileOrgMemberMutationResult> =>
      removeAlfredProfileOrgMember(
        getProfileUserDataPath(),
        orgMemberRemoveArgsFromUnknown(rawArgs)
      )
  )
}
