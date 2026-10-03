import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  listAlfredProfileOrgMembersMock,
  inviteAlfredProfileOrgMemberMock,
  revokeAlfredProfileOrgInviteMock,
  changeAlfredProfileOrgMemberRoleMock,
  removeAlfredProfileOrgMemberMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  listAlfredProfileOrgMembersMock: vi.fn(),
  inviteAlfredProfileOrgMemberMock: vi.fn(),
  revokeAlfredProfileOrgInviteMock: vi.fn(),
  changeAlfredProfileOrgMemberRoleMock: vi.fn(),
  removeAlfredProfileOrgMemberMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../alfred-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => '/tmp/alfred-user-data'
}))

vi.mock('../alfred-profiles/profile-cloud-org-members-service', () => ({
  listAlfredProfileOrgMembers: listAlfredProfileOrgMembersMock,
  inviteAlfredProfileOrgMember: inviteAlfredProfileOrgMemberMock,
  revokeAlfredProfileOrgInvite: revokeAlfredProfileOrgInviteMock,
  changeAlfredProfileOrgMemberRole: changeAlfredProfileOrgMemberRoleMock,
  removeAlfredProfileOrgMember: removeAlfredProfileOrgMemberMock
}))

import { registerAlfredProfileOrgMemberHandlers } from './alfred-profile-org-members-handlers'

function invoke(channel: string, args?: unknown): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`No handler for ${channel}`)
  }
  return handler({}, args)
}

describe('registerAlfredProfileOrgMemberHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    listAlfredProfileOrgMembersMock.mockReset().mockResolvedValue({ status: 'ok', roster: {} })
    inviteAlfredProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    revokeAlfredProfileOrgInviteMock.mockReset().mockResolvedValue({ status: 'ok' })
    changeAlfredProfileOrgMemberRoleMock.mockReset().mockResolvedValue({ status: 'ok' })
    removeAlfredProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    registerAlfredProfileOrgMemberHandlers()
  })

  it('registers all five org-member channels', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'alfredProfiles:orgInviteRevoke',
        'alfredProfiles:orgMemberChangeRole',
        'alfredProfiles:orgMemberInvite',
        'alfredProfiles:orgMemberRemove',
        'alfredProfiles:orgMembersList'
      ].sort()
    )
  })

  it('forwards a valid invite to the service with a trimmed email', async () => {
    await invoke('alfredProfiles:orgMemberInvite', {
      orgId: 'org-1',
      email: '  new@example.com  ',
      role: 'admin'
    })
    expect(inviteAlfredProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/alfred-user-data', {
      orgId: 'org-1',
      email: 'new@example.com',
      role: 'admin'
    })
  })

  it('rejects an invite with a missing org id', async () => {
    await expect(
      invoke('alfredProfiles:orgMemberInvite', { email: 'a@b.com', role: 'member' })
    ).rejects.toThrow('invalid_alfred_profile_org_selection')
    expect(inviteAlfredProfileOrgMemberMock).not.toHaveBeenCalled()
  })

  it('rejects an invite with an unknown role', async () => {
    await expect(
      invoke('alfredProfiles:orgMemberInvite', { orgId: 'org-1', email: 'a@b.com', role: 'root' })
    ).rejects.toThrow('invalid_alfred_org_role')
  })

  it('rejects a role change with a blank user id', async () => {
    await expect(
      invoke('alfredProfiles:orgMemberChangeRole', { orgId: 'org-1', userId: '  ', role: 'admin' })
    ).rejects.toThrow('invalid_alfred_org_member_user')
  })

  it('forwards remove and revoke with validated args', async () => {
    await invoke('alfredProfiles:orgMemberRemove', { orgId: 'org-1', userId: 'user-2' })
    expect(removeAlfredProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/alfred-user-data', {
      orgId: 'org-1',
      userId: 'user-2'
    })
    await invoke('alfredProfiles:orgInviteRevoke', { orgId: 'org-1', email: 'gone@b.com' })
    expect(revokeAlfredProfileOrgInviteMock).toHaveBeenCalledWith('/tmp/alfred-user-data', {
      orgId: 'org-1',
      email: 'gone@b.com'
    })
  })
})
