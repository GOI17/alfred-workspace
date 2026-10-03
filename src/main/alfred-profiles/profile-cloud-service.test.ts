import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AlfredCloudCapabilities,
  AlfredCloudOrgSummary,
  AlfredProfileCloudSummary
} from '../../shared/alfred-profiles'
import type { AlfredCloudSessionExchangeResponse } from './profile-cloud-session-exchange'

const {
  beginAlfredCloudPkceFlowMock,
  createAlfredCloudProfileMock,
  exchangeAlfredCloudAuthCodeMock,
  revokeAlfredCloudSessionMock,
  selectAlfredCloudOrgMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAlfredCloudPkceFlowMock: vi.fn(),
  createAlfredCloudProfileMock: vi.fn(),
  exchangeAlfredCloudAuthCodeMock: vi.fn(),
  revokeAlfredCloudSessionMock: vi.fn(),
  selectAlfredCloudOrgMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginAlfredCloudPkceFlow: beginAlfredCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createAlfredCloudProfile: createAlfredCloudProfileMock,
  exchangeAlfredCloudAuthCode: exchangeAlfredCloudAuthCodeMock,
  revokeAlfredCloudSession: revokeAlfredCloudSessionMock,
  selectAlfredCloudOrg: selectAlfredCloudOrgMock
}))

import {
  connectCurrentAlfredProfile,
  createCloudLinkedAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  selectCurrentAlfredProfileOrg,
  signOutCurrentAlfredProfile
} from './profile-cloud-service'

const cloudSummary: AlfredProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const capabilities: AlfredCloudCapabilities = {
  flags: { share: true },
  refreshedAt: 11
}

const organizations: AlfredCloudOrgSummary[] = [
  { orgId: 'org-1', name: 'Acme', role: 'Admin' },
  { orgId: 'org-2', name: 'Personal' }
]

function configureCloudEnv(): void {
  vi.stubEnv('ALFRED_CLOUD_API_URL', 'https://alfred-cloud.example')
  vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', 'desktop-client')
}

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function mockSuccessfulConnect(expiresAt = futureExpiresAt()): void {
  beginAlfredCloudPkceFlowMock.mockResolvedValue({
    code: 'auth-code',
    codeVerifier: 'code-verifier',
    nonce: 'nonce',
    redirectUri: 'http://127.0.0.1:4100/auth/callback',
    state: 'state'
  })
  exchangeAlfredCloudAuthCodeMock.mockResolvedValue({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresAt,
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AlfredCloudSessionExchangeResponse)
}

describe('Alfred cloud profile service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-cloud-service-'))
    beginAlfredCloudPkceFlowMock.mockReset()
    createAlfredCloudProfileMock.mockReset()
    exchangeAlfredCloudAuthCodeMock.mockReset()
    revokeAlfredCloudSessionMock.mockReset()
    selectAlfredCloudOrgMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    revokeAlfredCloudSessionMock.mockResolvedValue(undefined)
    vi.unstubAllEnvs()
    vi.stubEnv('ALFRED_CLOUD_API_URL', '')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports local unconfigured auth without cloud setup', () => {
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      activeProfileId: 'local-default',
      configured: false,
      state: 'unconfigured',
      persistence: 'none'
    })
  })

  it('connects the active local profile without replacing its local profile ID', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()

    const result = await connectCurrentAlfredProfile(userDataPath)

    if (result.status !== 'connected') {
      throw new Error(`Expected connected result, got ${result.status}`)
    }
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({
      id: 'local-default',
      kind: 'cloud-linked',
      cloud: cloudSummary
    })
    expect(exchangeAlfredCloudAuthCodeMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ localProfileId: 'local-default', nonce: 'nonce' })
    )
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      persistence: 'encrypted',
      cloud: cloudSummary,
      organizations,
      capabilities
    })
  })

  it('treats provider-denied sign-in as a cancelled connect attempt', async () => {
    configureCloudEnv()
    beginAlfredCloudPkceFlowMock.mockRejectedValue(new Error('alfred_cloud_auth_denied'))

    const result = await connectCurrentAlfredProfile(userDataPath)

    expect(result.status).toBe('cancelled')
    expect(exchangeAlfredCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
  })

  it('reports callback failures as failed instead of cancelled', async () => {
    configureCloudEnv()
    beginAlfredCloudPkceFlowMock.mockRejectedValue(new Error('alfred_cloud_auth_callback_failed'))

    const result = await connectCurrentAlfredProfile(userDataPath)

    expect(result).toMatchObject({ status: 'failed', error: 'alfred_cloud_auth_callback_failed' })
    expect(exchangeAlfredCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({ state: 'local' })
  })

  it('does not report a saved cloud session as connected when cloud config is unavailable', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAlfredProfile(userDataPath)
    vi.stubEnv('ALFRED_CLOUD_API_URL', '')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', '')

    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      configured: false,
      state: 'unconfigured',
      persistence: 'encrypted',
      cloud: cloudSummary,
      setupMessage: 'Alfred Cloud sign-in is not configured for this build.'
    })
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).organizations).toBeUndefined()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).capabilities).toBeUndefined()
  })

  it('signs out by removing cloud metadata while keeping the local profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAlfredProfile(userDataPath)

    const result = await signOutCurrentAlfredProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(result.activeProfileId).toBe('local-default')
    expect(result.profiles[0]).toMatchObject({ id: 'local-default', kind: 'local' })
    expect(result.profiles[0]?.cloud).toBeUndefined()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'local',
      persistence: 'none'
    })
    expect(revokeAlfredCloudSessionMock).toHaveBeenCalledOnce()
  })

  it('creates a new empty cloud-linked profile with its own cloud session', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAlfredProfile(userDataPath)
    createAlfredCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: 1000,
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities: { flags: { share: true, team: true }, refreshedAt: 13 }
    } satisfies AlfredCloudSessionExchangeResponse)

    const result = await createCloudLinkedAlfredProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    if (result.status !== 'created') {
      throw new Error(`Expected created result, got ${result.status}`)
    }
    expect(result.profile).toMatchObject({
      id: expect.stringMatching(/^cloud-/),
      name: 'Acme',
      kind: 'cloud-linked',
      cloud: expect.objectContaining({ cloudProfileId: 'cloud-profile-2' })
    })
    expect(createAlfredCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('selects an organization for a connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAlfredProfile(userDataPath)
    const orgCloudSummary = {
      ...cloudSummary,
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    }
    selectAlfredCloudOrgMock.mockResolvedValue({
      cloud: orgCloudSummary,
      organizations,
      capabilities: { flags: { share: true, sso: true }, refreshedAt: 12 }
    })

    const result = await selectCurrentAlfredProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectAlfredCloudOrgMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' }),
      'org-1'
    )
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'org-1',
      activeOrgName: 'Acme'
    })
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).organizations).toEqual(organizations)
  })
})
