import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type {
  AlfredCloudCapabilities,
  AlfredCloudOrgSummary,
  AlfredProfileCloudSummary
} from '../../shared/alfred-profiles'

const {
  beginAlfredCloudPkceFlowMock,
  exchangeAlfredCloudAuthCodeMock,
  revokeAlfredCloudSessionMock,
  safeStorageMock
} = vi.hoisted(() => ({
  beginAlfredCloudPkceFlowMock: vi.fn(),
  exchangeAlfredCloudAuthCodeMock: vi.fn(),
  revokeAlfredCloudSessionMock: vi.fn(),
  safeStorageMock: {
    decryptString: vi.fn((value: Buffer) => value.toString('utf-8')),
    encryptString: vi.fn((value: string) => Buffer.from(value, 'utf-8')),
    isEncryptionAvailable: vi.fn(() => true)
  }
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginAlfredCloudPkceFlow: beginAlfredCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createAlfredCloudProfile: vi.fn(),
  exchangeAlfredCloudAuthCode: exchangeAlfredCloudAuthCodeMock,
  revokeAlfredCloudSession: revokeAlfredCloudSessionMock,
  selectAlfredCloudOrg: vi.fn()
}))

import {
  connectCurrentAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  signOutCurrentAlfredProfile
} from './profile-cloud-service'

const cloud: AlfredProfileCloudSummary = {
  cloudProfileId: 'cloud-profile-1',
  userId: 'user-1',
  email: 'nina@example.com',
  displayName: 'Nina',
  linkedAt: 10
}

const laterCloud: AlfredProfileCloudSummary = {
  ...cloud,
  cloudProfileId: 'cloud-profile-2',
  email: 'ada@example.com'
}

const capabilities: AlfredCloudCapabilities = { flags: { share: true }, refreshedAt: 11 }
const organizations: AlfredCloudOrgSummary[] = [{ orgId: 'org-1', name: 'Acme', role: 'Admin' }]

describe('Alfred cloud sign-out vs newer connect', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-cloud-sign-out-connect-'))
    beginAlfredCloudPkceFlowMock.mockReset()
    exchangeAlfredCloudAuthCodeMock.mockReset()
    revokeAlfredCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.stubEnv('ALFRED_CLOUD_API_URL', 'https://alfred-cloud.example')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', 'desktop-client')
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
      expiresAt: Date.now() + 3_600_000,
      cloud,
      organizations,
      capabilities
    })
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('keeps a newer connect that finishes while sign-out is still revoking', async () => {
    await expect(connectCurrentAlfredProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    let finishRevoke!: () => void
    revokeAlfredCloudSessionMock.mockReturnValue(
      new Promise<void>((resolve) => {
        finishRevoke = resolve
      })
    )
    const signingOut = signOutCurrentAlfredProfile(userDataPath)
    exchangeAlfredCloudAuthCodeMock.mockResolvedValue({
      accessToken: 'later-access',
      refreshToken: 'later-refresh',
      expiresAt: Date.now() + 3_600_000,
      cloud: laterCloud,
      organizations,
      capabilities
    })
    await expect(connectCurrentAlfredProfile(userDataPath)).resolves.toMatchObject({
      status: 'connected'
    })
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).cloud?.email).toBe('ada@example.com')
    finishRevoke()
    await expect(signingOut).resolves.toMatchObject({ status: 'signed-out' })
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      state: 'connected',
      cloud: { email: 'ada@example.com' }
    })
  })
})
