import { getAlfredCloudAuthConfig, type AlfredCloudAuthConfig } from './profile-cloud-auth-config'
export function makeCloudAuthConfig(
  overrides: Partial<AlfredCloudAuthConfig> = {}
): AlfredCloudAuthConfig {
  const result = getAlfredCloudAuthConfig(
    { ALFRED_CLOUD_API_URL: 'https://login.example.test', ALFRED_CLOUD_CLIENT_ID: 'test-client' },
    false
  )
  if (!result.configured) {
    throw new Error(result.setupMessage)
  }
  return { ...result.config, ...overrides }
}
