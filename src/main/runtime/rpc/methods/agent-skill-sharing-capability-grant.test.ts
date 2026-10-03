import { createRuntimeStoreTestDouble } from '../../runtime-store-test-double'
import { describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { AlfredRuntimeService } from '../../alfred-runtime'
import { SettingsUpdate } from './client-settings-schemas'

vi.mock('electron', () => ({
  app: { getPath: () => '/alfred-state', isPackaged: true }
}))

function runtimeWithSharing(agentSkillSharingEnabled: unknown): AlfredRuntimeService {
  return new AlfredRuntimeService(
    createRuntimeStoreTestDouble({
      getSettings: () => {
        // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: Malformed persisted flags intentionally exercise fail-closed capability admission.
        return { ...getDefaultSettings('/tmp'), agentSkillSharingEnabled } as ReturnType<
          typeof getDefaultSettings
        >
      }
    })
  )
}

describe('agent skill publish capability cannot be granted over RPC', () => {
  it('rejects settings.update attempts to enable it', () => {
    expect(SettingsUpdate.safeParse({ agentSkillSharingEnabled: true }).success).toBe(false)
  })

  it('publishes the capability read-only through settings.get', () => {
    expect(runtimeWithSharing(true).getClientSettings().agentSkillSharingEnabled).toBe(true)
    expect(runtimeWithSharing(false).getClientSettings().agentSkillSharingEnabled).toBe(false)
    expect(runtimeWithSharing(undefined).getClientSettings().agentSkillSharingEnabled).toBe(false)
  })

  it('fails closed for truthy non-booleans', () => {
    expect(runtimeWithSharing('yes').getClientSettings().agentSkillSharingEnabled).toBe(false)
  })
})
