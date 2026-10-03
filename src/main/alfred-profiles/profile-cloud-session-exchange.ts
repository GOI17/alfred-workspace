import type {
  AlfredCloudCapabilities,
  AlfredCloudOrgSummary,
  AlfredProfileCloudSummary
} from '../../shared/alfred-profiles'

export type AlfredCloudSessionExchangeResponse = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  cloud: AlfredProfileCloudSummary
  organizations?: AlfredCloudOrgSummary[]
  capabilities: AlfredCloudCapabilities
}
