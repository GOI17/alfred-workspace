import { cleanCloudServiceOrigin } from '../../../shared/cloud-service-url'

export function resolvePushGatewayOrigin(env: NodeJS.ProcessEnv, packaged: boolean): string {
  return (
    cleanCloudServiceOrigin(env.ALFRED_PUSH_GATEWAY_URL, !packaged) ?? 'https://push.alfredlabs.org'
  )
}
