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
  selectAlfredCloudOrgMock,
  AlfredCloudRequestErrorMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAlfredCloudPkceFlowMock: vi.fn(),
  createAlfredCloudProfileMock: vi.fn(),
  exchangeAlfredCloudAuthCodeMock: vi.fn(),
  refreshAlfredCloudCapabilitiesMock: vi.fn(),
  refreshAlfredCloudSessionMock: vi.fn(),
  selectAlfredCloudOrgMock: vi.fn(),
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
  selectAlfredCloudOrg: selectAlfredCloudOrgMock
}))

import {
  connectCurrentAlfredProfile,
  createCloudLinkedAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  refreshCurrentAlfredProfileAuth,
  selectCurrentAlfredProfileOrg
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

function mockSuccessfulConnect(): void {
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
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AlfredCloudSessionExchangeResponse)
}

function mockSuccessfulSessionRefresh(): void {
  refreshAlfredCloudSessionMock.mockResolvedValue({
    accessToken: 'rotated-access-token',
    refreshToken: 'rotated-refresh-token',
    expiresAt: futureExpiresAt(),
    cloud: cloudSummary,
    organizations,
    capabilities
  } satisfies AlfredCloudSessionExchangeResponse)
}

describe('Alfred cloud profile auth-failure retry', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-cloud-service-auth-retry-'))
    beginAlfredCloudPkceFlowMock.mockReset()
    createAlfredCloudProfileMock.mockReset()
    exchangeAlfredCloudAuthCodeMock.mockReset()
    refreshAlfredCloudCapabilitiesMock.mockReset()
    refreshAlfredCloudSessionMock.mockReset()
    selectAlfredCloudOrgMock.mockReset()
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

  it('refreshes and retries cloud profile creation after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAlfredProfile(userDataPath)
    createAlfredCloudProfileMock
      .mockRejectedValueOnce(new AlfredCloudRequestErrorMock(401))
      .mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: futureExpiresAt(),
        cloud: { ...cloudSummary, cloudProfileId: 'cloud-profile-2' },
        organizations,
        capabilities
      } satisfies AlfredCloudSessionExchangeResponse)

    const result = await createCloudLinkedAlfredProfile(userDataPath, { name: 'Acme' })

    expect(result.status).toBe('created')
    expect(createAlfredCloudProfileMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      { name: 'Acme' }
    )
  })

  it('refreshes and retries capability refresh after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudCapabilitiesMock
      .mockRejectedValueOnce(new AlfredCloudRequestErrorMock(403))
      .mockResolvedValue({
        capabilities: { flags: { share: false }, refreshedAt: 26 } satisfies AlfredCloudCapabilities
      })

    const result = await refreshCurrentAlfredProfileAuth(userDataPath)

    expect(result.status).toBe('refreshed')
    expect(refreshAlfredCloudCapabilitiesMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' })
    )
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).capabilities).toEqual({
      flags: { share: false },
      refreshedAt: 26
    })
  })

  it('requires reconnect when a retried capability refresh is still unauthorized', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAlfredProfile(userDataPath)
    refreshAlfredCloudCapabilitiesMock
      .mockRejectedValueOnce(new AlfredCloudRequestErrorMock(401))
      .mockRejectedValueOnce(new AlfredCloudRequestErrorMock(401))

    const result = await refreshCurrentAlfredProfileAuth(userDataPath)

    expect(result.status).toBe('reconnect-required')
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'reconnect-required',
      persistence: 'none',
      cloud: cloudSummary
    })
  })

  it('refreshes and retries organization selection after an auth failure', async () => {
    configureCloudEnv()
    mockSuccessfulConnect()
    mockSuccessfulSessionRefresh()
    await connectCurrentAlfredProfile(userDataPath)
    selectAlfredCloudOrgMock
      .mockRejectedValueOnce(new AlfredCloudRequestErrorMock(401))
      .mockResolvedValue({
        cloud: { ...cloudSummary, activeOrgId: 'org-1', activeOrgName: 'Acme' },
        organizations,
        capabilities
      })

    const result = await selectCurrentAlfredProfileOrg(userDataPath, 'org-1')

    expect(result.status).toBe('selected')
    expect(selectAlfredCloudOrgMock).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ accessToken: 'rotated-access-token' }),
      'org-1'
    )
  })
})
