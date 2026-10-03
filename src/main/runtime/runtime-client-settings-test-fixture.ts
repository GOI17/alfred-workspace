import { getDefaultSettings } from '../../shared/constants'
import type { RuntimeClientSettings } from './runtime-client-settings'

export function getDefaultRuntimeClientSettings(): RuntimeClientSettings {
  return { ...getDefaultSettings('/tmp'), hostSettingOverrides: {} }
}
