import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AlfredOrgMembersRoster } from '../../shared/alfred-profiles'
import { AlfredCloudRequestError } from './profile-cloud-client'

const {
  runWithFreshAlfredCloudSessionMock,
  listAlfredCloudOrgMembersMock,
  inviteAlfredCloudOrgMemberMock,
  revokeAlfredCloudOrgInviteMock,
  changeAlfredCloudOrgMemberRoleMock,
  removeAlfredCloudOrgMemberMock
} = vi.hoisted(() => ({
  runWithFreshAlfredCloudSessionMock: vi.fn(),
  listAlfredCloudOrgMembersMock: vi.fn(),
  inviteAlfredCloudOrgMemberMock: vi.fn(),
  revokeAlfredCloudOrgInviteMock: vi.fn(),
  changeAlfredCloudOrgMemberRoleMock: vi.fn(),
  removeAlfredCloudOrgMemberMock: vi.fn()
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath }
}))

vi.mock('./profile-cloud-session-refresh', () => ({
  runWithFreshAlfredCloudSessionMock,
  runWithFreshAlfredCloudSession: runWithFreshAlfredCloudSessionMock
}))

vi.mock('./profile-cloud-org-members-client', () => ({
  listAlfredCloudOrgMembers: listAlfredCloudOrgMembersMock,
  inviteAlfredCloudOrgMember: inviteAlfredCloudOrgMemberMock,
  revokeAlfredCloudOrgInvite: revokeAlfredCloudOrgInviteMock,
  changeAlfredCloudOrgMemberRole: changeAlfredCloudOrgMemberRoleMock,
  removeAlfredCloudOrgMember: removeAlfredCloudOrgMemberMock
}))

import {
  changeAlfredProfileOrgMemberRole,
  inviteAlfredProfileOrgMember,
  listAlfredProfileOrgMembers,
  removeAlfredProfileOrgMember,
  revokeAlfredProfileOrgInvite
} from './profile-cloud-org-members-service'

const fakeSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 3_600_000,
  capabilities: { flags: {}, refreshedAt: 1 }
}

// Why: mirror the real contract — invoke the operation with a live session and
// surface its resolved value; business 4xx are returned by the operation as
// values, never thrown, so the session layer never sees them.
function runOperationDirectly(): void {
  runWithFreshAlfredCloudSessionMock.mockImplementation(
    async (
      _config: unknown,
      _active: unknown,
      _path: unknown,
      op: (session: unknown) => unknown
    ) => ({
      status: 'ok',
      value: await op(fakeSession)
    })
  )
}

function configureCloudEnv(): void {
  vi.stubEnv('ALFRED_CLOUD_API_URL', 'https://alfred-cloud.example')
  vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', 'desktop-client')
}

const roster: AlfredOrgMembersRoster = {
  members: [{ userId: 'user-1', email: 'nina@example.com', role: 'owner' }],
  pendingInvites: [],
  viewerRole: 'owner',
  canManageMembers: true
}

describe('Alfred cloud org members service (configured)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-org-members-'))
    runWithFreshAlfredCloudSessionMock.mockReset()
    listAlfredCloudOrgMembersMock.mockReset()
    inviteAlfredCloudOrgMemberMock.mockReset()
    revokeAlfredCloudOrgInviteMock.mockReset()
    changeAlfredCloudOrgMemberRoleMock.mockReset()
    removeAlfredCloudOrgMemberMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('ALFRED_CLOUD_DEV_AUTH', '')
    vi.stubEnv('ALFRED_CLOUD_API_URL', '')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports unconfigured when cloud sign-in is not set up', async () => {
    await expect(listAlfredProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'unconfigured'
    })
    expect(runWithFreshAlfredCloudSessionMock).not.toHaveBeenCalled()
  })

  it('returns the roster from the client', async () => {
    configureCloudEnv()
    runOperationDirectly()
    listAlfredCloudOrgMembersMock.mockResolvedValue(roster)

    await expect(listAlfredProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'ok',
      roster
    })
    expect(listAlfredCloudOrgMembersMock).toHaveBeenCalledWith(
      expect.any(Object),
      fakeSession,
      'org-1'
    )
  })

  it('maps a 409 already_member invite conflict', async () => {
    configureCloudEnv()
    runOperationDirectly()
    inviteAlfredCloudOrgMemberMock.mockRejectedValue(
      new AlfredCloudRequestError(409, 'already_member')
    )

    await expect(
      inviteAlfredProfileOrgMember(userDataPath, {
        orgId: 'org-1',
        email: 'a@b.com',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_member' })
  })

  it('maps a 403 role change to forbidden', async () => {
    configureCloudEnv()
    runOperationDirectly()
    changeAlfredCloudOrgMemberRoleMock.mockRejectedValue(new AlfredCloudRequestError(403))

    await expect(
      changeAlfredProfileOrgMemberRole(userDataPath, {
        orgId: 'org-1',
        userId: 'user-2',
        role: 'admin'
      })
    ).resolves.toEqual({ status: 'forbidden' })
  })

  it('maps a 400 cannot_remove_self to an invalid result', async () => {
    configureCloudEnv()
    runOperationDirectly()
    removeAlfredCloudOrgMemberMock.mockRejectedValue(
      new AlfredCloudRequestError(400, 'cannot_remove_self')
    )

    await expect(
      removeAlfredProfileOrgMember(userDataPath, { orgId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_remove_self' })
  })

  it('maps a 404 revoke to not-found', async () => {
    configureCloudEnv()
    runOperationDirectly()
    revokeAlfredCloudOrgInviteMock.mockRejectedValue(new AlfredCloudRequestError(404))

    await expect(
      revokeAlfredProfileOrgInvite(userDataPath, { orgId: 'org-1', email: 'gone@b.com' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('reports reconnect-required when the session layer cannot refresh', async () => {
    configureCloudEnv()
    runWithFreshAlfredCloudSessionMock.mockResolvedValue({ status: 'reconnect-required' })

    await expect(listAlfredProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'reconnect-required'
    })
  })
})

describe('Alfred cloud org members service (dev auth)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-org-members-dev-'))
    runWithFreshAlfredCloudSessionMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('ALFRED_CLOUD_DEV_AUTH', '1')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('serves an in-memory roster the caller can manage', async () => {
    const result = await listAlfredProfileOrgMembers(userDataPath, 'dev-list-org')
    if (result.status !== 'ok') {
      throw new Error(`Expected ok, got ${result.status}`)
    }
    expect(result.roster.canManageMembers).toBe(true)
    expect(result.roster.viewerRole).toBe('owner')
    expect(result.roster.members[0]).toMatchObject({ role: 'owner' })
    expect(result.roster.members.some((member) => member.userId === null)).toBe(true)
    expect(result.roster.pendingInvites.length).toBeGreaterThan(0)
    expect(runWithFreshAlfredCloudSessionMock).not.toHaveBeenCalled()
  })

  it('mutates the dev roster across invite and revoke', async () => {
    const orgId = 'dev-mutate-org'
    await expect(
      inviteAlfredProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@alfred.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'ok' })

    const afterInvite = await listAlfredProfileOrgMembers(userDataPath, orgId)
    if (afterInvite.status !== 'ok') {
      throw new Error('expected ok')
    }
    expect(afterInvite.roster.pendingInvites.some((i) => i.email === 'fresh@alfred.local')).toBe(
      true
    )

    await expect(
      inviteAlfredProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@alfred.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_invited' })

    await expect(
      revokeAlfredProfileOrgInvite(userDataPath, { orgId, email: 'fresh@alfred.local' })
    ).resolves.toEqual({ status: 'ok' })
    await expect(
      revokeAlfredProfileOrgInvite(userDataPath, { orgId, email: 'fresh@alfred.local' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('blocks changing the dev owner (self) role', async () => {
    const orgId = 'dev-self-org'
    const list = await listAlfredProfileOrgMembers(userDataPath, orgId)
    if (list.status !== 'ok') {
      throw new Error('expected ok')
    }
    const self = list.roster.members.find((member) => member.role === 'owner')
    await expect(
      changeAlfredProfileOrgMemberRole(userDataPath, {
        orgId,
        userId: self?.userId ?? 'dev-user',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_change_own_role' })
  })
})
