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
  refreshAlfredCloudCapabilitiesMock,
  refreshAlfredCloudSessionMock,
  AlfredCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAlfredCloudPkceFlowMock: vi.fn(),
  createAlfredCloudProfileMock: vi.fn(),
  exchangeAlfredCloudAuthCodeMock: vi.fn(),
  refreshAlfredCloudCapabilitiesMock: vi.fn(),
  refreshAlfredCloudSessionMock: vi.fn(),
  AlfredCloudRequestErrorMock: class AlfredCloudRequestError extends Error {
    constructor(public readonly statusCode: number) {
      super(`alfred_cloud_request_failed_${statusCode}`)
      this.name = 'AlfredCloudRequestError'
    }
  },
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
  AlfredCloudRequestError: AlfredCloudRequestErrorMock,
  isAmbiguousCloudRequestFailure: (error: unknown) =>
    !(error instanceof AlfredCloudRequestErrorMock),
  createAlfredCloudProfile: createAlfredCloudProfileMock,
  exchangeAlfredCloudAuthCode: exchangeAlfredCloudAuthCodeMock,
  refreshAlfredCloudCapabilities: refreshAlfredCloudCapabilitiesMock,
  refreshAlfredCloudSession: refreshAlfredCloudSessionMock,
  revokeAlfredCloudSession: vi.fn(),
  selectAlfredCloudOrg: vi.fn()
}))

import {
  connectCurrentAlfredProfile,
  createCloudLinkedAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  refreshCurrentAlfredProfileAuth
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

function futureExpiresAt(): number {
  return Date.now() + 3_600_000
}

function configureCloudEnv(): void {
  vi.stubEnv('ALFRED_CLOUD_API_URL', 'https://alfred-cloud.example')
  vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', 'desktop-client')
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

describe('Alfred cloud profile service session refresh', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-cloud-service-refresh-'))
    beginAlfredCloudPkceFlowMock.mockReset()
    createAlfredCloudProfileMock.mockReset()
    exchangeAlfredCloudAuthCodeMock.mockReset()
    refreshAlfredCloudCapabilitiesMock.mockReset()
    refreshAlfredCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('ALFRED_CLOUD_API_URL', '')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('refreshes an expired access token before creating cloud profiles', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudSessionMock.mockResolvedValue({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: cloudSummary,
      organizations,
      capabilities
    } satisfies AlfredCloudSessionExchangeResponse)
    createAlfredCloudProfileMock.mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: {
        ...cloudSummary,
        cloudProfileId: 'cloud-profile-2',
        activeOrgId: 'org-1',
        activeOrgName: 'Acme'
      },
      organizations,
      capabilities
    } satisfies AlfredCloudSessionExchangeResponse)

    const result = await createCloudLinkedAlfredProfile(userDataPath, {
      orgId: 'org-1',
      name: 'Acme'
    })

    expect(result.status).toBe('created')
    expect(refreshAlfredCloudSessionMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ refreshToken: 'refresh-token' })
    )
    expect(createAlfredCloudProfileMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { orgId: 'org-1', name: 'Acme' }
    )
  })

  it('refreshes capability flags for the connected profile', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudCapabilitiesMock.mockResolvedValue({
      capabilities: {
        flags: { share: false, team: true },
        refreshedAt: 25
      }
    })

    const result = await refreshCurrentAlfredProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshAlfredCloudCapabilitiesMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accessToken: 'access-token' })
    )
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false, team: true },
      refreshedAt: 25
    })
  })

  it('clears stale active org metadata when capability refresh returns no active org', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    exchangeAlfredCloudAuthCodeMock.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: futureExpiresAt(),
      cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
      organizations,
      capabilities
    } satisfies AlfredCloudSessionExchangeResponse)
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudCapabilitiesMock.mockResolvedValue({
      cloud: cloudSummary,
      organizations: [],
      capabilities: {
        flags: { share: false },
        refreshedAt: 31
      }
    })

    const result = await refreshCurrentAlfredProfileAuth(userDataPath)
    const status = getCurrentAlfredProfileAuthStatus(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(status.cloud?.activeOrgId).toBeUndefined()
    expect(status.cloud?.activeOrgName).toBeUndefined()
    expect(status.organizations).toEqual([])
    expect(status.capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 31
    })
  })

  it('requires reconnect when an expired refresh token is rejected', async () => {
    configureCloudEnv()
    mockSuccessfulConnect(Date.now() - 1_000)
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudSessionMock.mockRejectedValue(new AlfredCloudRequestErrorMock(401))

    const result = await refreshCurrentAlfredProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })
})
