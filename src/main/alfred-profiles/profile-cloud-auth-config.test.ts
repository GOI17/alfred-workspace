import { describe, expect, it, vi } from 'vitest'
import {
  allowsPlaintextAlfredCloudSession,
  getAlfredCloudAuthConfig,
  isAlfredCloudDevAuthEnabled
} from './profile-cloud-auth-config'

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

describe('Alfred cloud auth config', () => {
  it('reports unconfigured without both API URL and client ID', () => {
    expect(getAlfredCloudAuthConfig({})).toEqual({
      configured: false,
      setupMessage: 'Alfred Cloud sign-in is not configured for this build.'
    })
  })

  it('builds default desktop auth endpoints from the API URL', () => {
    const state = getAlfredCloudAuthConfig({
      ALFRED_CLOUD_API_URL: 'https://alfred-cloud.example/',
      ALFRED_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://alfred-cloud.example',
        authorizeEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/session',
        refreshEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/profile',
        orgEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/org',
        logoutEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://alfred-cloud.example/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.alfredlabs.org',
        clientId: 'desktop-client',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('uses first-party production endpoints without runtime env in packaged builds', () => {
    expect(getAlfredCloudAuthConfig({}, true)).toEqual({
      configured: true,
      config: {
        apiBaseUrl: 'https://login.alfredlabs.org',
        authorizeEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/authorize',
        sessionEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/session',
        refreshEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/refresh',
        capabilitiesEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/capabilities',
        profileEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/profile',
        orgEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/org',
        logoutEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/logout',
        relayTokenEndpoint: 'https://login.alfredlabs.org/v1/desktop/auth/relay-token',
        relayDirectorUrl: 'https://relay.alfredlabs.org',
        clientId: 'alfred-desktop',
        scope: 'openid profile email offline_access'
      }
    })
  })

  it('allows loopback HTTP endpoints for local desktop auth development', () => {
    const state = getAlfredCloudAuthConfig({
      ALFRED_CLOUD_API_URL: 'http://localhost:4100',
      ALFRED_CLOUD_CLIENT_ID: 'desktop-client'
    })

    expect(state.configured).toBe(true)
  })

  it('rejects loopback HTTP endpoints in packaged builds', () => {
    expect(
      getAlfredCloudAuthConfig(
        {
          ALFRED_CLOUD_API_URL: 'http://localhost:4100',
          ALFRED_CLOUD_CLIENT_ID: 'desktop-client'
        },
        true
      )
    ).toMatchObject({ configured: false })

    const httpsState = getAlfredCloudAuthConfig(
      {
        ALFRED_CLOUD_API_URL: 'https://alfred-cloud.example',
        ALFRED_CLOUD_CLIENT_ID: 'desktop-client'
      },
      true
    )
    expect(httpsState.configured).toBe(true)
  })

  it('rejects non-HTTPS non-loopback API URLs', () => {
    expect(
      getAlfredCloudAuthConfig({
        ALFRED_CLOUD_API_URL: 'http://alfred-cloud.example',
        ALFRED_CLOUD_CLIENT_ID: 'desktop-client'
      })
    ).toMatchObject({ configured: false })
  })

  it('allows dev plaintext sessions only outside production', () => {
    expect(
      allowsPlaintextAlfredCloudSession({
        ALFRED_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      allowsPlaintextAlfredCloudSession({
        ALFRED_CLOUD_ALLOW_PLAINTEXT_SESSION: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })

  it('ignores dev flags in packaged builds even without NODE_ENV', () => {
    // Why: packaged main bundles never define NODE_ENV, so packaged-ness must
    // gate the escape hatches on its own.
    expect(
      allowsPlaintextAlfredCloudSession({ ALFRED_CLOUD_ALLOW_PLAINTEXT_SESSION: '1' }, true)
    ).toBe(false)
    expect(isAlfredCloudDevAuthEnabled({ ALFRED_CLOUD_DEV_AUTH: '1' }, true)).toBe(false)
  })

  it('allows local dev auth only outside production', () => {
    expect(
      isAlfredCloudDevAuthEnabled({
        ALFRED_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'development'
      })
    ).toBe(true)
    expect(
      isAlfredCloudDevAuthEnabled({
        ALFRED_CLOUD_DEV_AUTH: '1',
        NODE_ENV: 'production'
      })
    ).toBe(false)
  })
})
