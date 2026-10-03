import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  app: {
    getPath: () => userDataPath
  },
  safeStorage: safeStorageMock
}))

vi.mock('./profile-cloud-pkce', () => ({
  beginAlfredCloudPkceFlow: beginAlfredCloudPkceFlowMock
}))

vi.mock('./profile-cloud-client', () => ({
  createAlfredCloudProfile: vi.fn(),
  exchangeAlfredCloudAuthCode: exchangeAlfredCloudAuthCodeMock,
  refreshAlfredCloudCapabilities: vi.fn(),
  refreshAlfredCloudSession: vi.fn(),
  revokeAlfredCloudSession: revokeAlfredCloudSessionMock,
  selectAlfredCloudOrg: vi.fn()
}))

import {
  connectCurrentAlfredProfile,
  createCloudLinkedAlfredProfile,
  getCurrentAlfredProfileAuthStatus,
  selectCurrentAlfredProfileOrg,
  signOutCurrentAlfredProfile
} from './profile-cloud-service'

describe('Alfred cloud dev auth service', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'alfred-cloud-dev-auth-'))
    beginAlfredCloudPkceFlowMock.mockReset()
    exchangeAlfredCloudAuthCodeMock.mockReset()
    revokeAlfredCloudSessionMock.mockReset()
    safeStorageMock.decryptString.mockReset()
    safeStorageMock.encryptString.mockReset()
    safeStorageMock.isEncryptionAvailable.mockReset()
    safeStorageMock.decryptString.mockImplementation((value: Buffer) => value.toString('utf-8'))
    safeStorageMock.encryptString.mockImplementation((value: string) => Buffer.from(value, 'utf-8'))
    safeStorageMock.isEncryptionAvailable.mockReturnValue(true)
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('ALFRED_CLOUD_DEV_AUTH', '1')
    vi.stubEnv('ALFRED_CLOUD_API_URL', '')
    vi.stubEnv('ALFRED_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('connects the active profile without PKCE or cloud endpoints', async () => {
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local'
    })

    const result = await connectCurrentAlfredProfile(userDataPath)

    expect(result.status).toBe('connected')
    expect(beginAlfredCloudPkceFlowMock).not.toHaveBeenCalled()
    expect(exchangeAlfredCloudAuthCodeMock).not.toHaveBeenCalled()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'connected',
      persistence: 'encrypted',
      cloud: {
        cloudProfileId: 'dev-cloud-local-default',
        email: 'dev@alfred.local'
      },
      capabilities: {
        flags: expect.objectContaining({ 'share.create': true })
      }
    })
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).organizations).toHaveLength(2)
  })

  it('selects dev organizations and creates org-scoped cloud profiles locally', async () => {
    await connectCurrentAlfredProfile(userDataPath)

    const selected = await selectCurrentAlfredProfileOrg(userDataPath, 'dev-acme')
    const created = await createCloudLinkedAlfredProfile(userDataPath, {
      orgId: 'dev-acme',
      name: 'Acme Dev'
    })

    expect(selected.status).toBe('selected')
    expect(getCurrentAlfredProfileAuthStatus(userDataPath).cloud).toMatchObject({
      activeOrgId: 'dev-acme',
      activeOrgName: 'Acme Dev'
    })
    expect(created.status).toBe('created')
    if (created.status === 'created') {
      expect(created.profile).toMatchObject({
        name: 'Acme Dev',
        kind: 'cloud-linked',
        cloud: expect.objectContaining({
          activeOrgId: 'dev-acme',
          activeOrgName: 'Acme Dev'
        })
      })
    }
  })

  it('signs out locally without calling the cloud logout endpoint', async () => {
    await connectCurrentAlfredProfile(userDataPath)

    const result = await signOutCurrentAlfredProfile(userDataPath)

    expect(result.status).toBe('signed-out')
    expect(revokeAlfredCloudSessionMock).not.toHaveBeenCalled()
    expect(getCurrentAlfredProfileAuthStatus(userDataPath)).toMatchObject({
      configured: true,
      state: 'local',
      persistence: 'none'
    })
  })
})
