import type { PreloadApi } from '../../../../preload/api-types'
import {
  DEFAULT_LOCAL_ALFRED_PROFILE_ID,
  createDefaultLocalAlfredProfile
} from '../../../../shared/alfred-profiles'
import { noopUnsubscribe } from './web-storage'

export function createWebAlfredProfilesApi(): Partial<PreloadApi> {
  const webAlfredProfileAuthStatus = () =>
    Promise.resolve({
      activeProfileId: DEFAULT_LOCAL_ALFRED_PROFILE_ID,
      configured: false,
      state: 'unconfigured' as const,
      persistence: 'none' as const,
      setupMessage: 'Alfred Cloud sign-in is not available in the browser fallback.'
    })
  return {
    alfredProfiles: {
      list: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_ALFRED_PROFILE_ID,
          profiles: [createDefaultLocalAlfredProfile(0)],
          multiProfileUi: false
        }),
      authStatus: webAlfredProfileAuthStatus,
      onAuthStatusChanged: () => noopUnsubscribe,
      createLocal: () =>
        Promise.resolve({
          activeProfileId: DEFAULT_LOCAL_ALFRED_PROFILE_ID,
          profiles: [createDefaultLocalAlfredProfile(0)],
          profile: createDefaultLocalAlfredProfile(0)
        }),
      createCloudLinked: async () => ({
        status: 'unconfigured',
        auth: await webAlfredProfileAuthStatus()
      }),
      switchProfile: () => Promise.resolve({ status: 'already-active' }),
      transferProject: (args) =>
        Promise.resolve({
          status: 'duplicate-target',
          sourceProfileId: args.sourceProfileId,
          targetProfileId: args.targetProfileId,
          sourceRepoId: args.repoId,
          duplicateRepoId: args.repoId
        }),
      findProjectProfiles: async () => ({ projects: [] }),
      connectCurrent: async () => ({
        status: 'unconfigured',
        auth: await webAlfredProfileAuthStatus()
      }),
      refreshAuth: async () => ({
        status: 'unconfigured',
        auth: await webAlfredProfileAuthStatus()
      }),
      signOutCurrent: async () => ({
        status: 'signed-out',
        auth: await webAlfredProfileAuthStatus(),
        activeProfileId: DEFAULT_LOCAL_ALFRED_PROFILE_ID,
        profiles: [createDefaultLocalAlfredProfile(0)]
      }),
      selectOrg: async () => ({
        status: 'unconfigured',
        auth: await webAlfredProfileAuthStatus()
      }),
      orgMembersList: async () => ({ status: 'unconfigured' }),
      orgMemberInvite: async () => ({ status: 'unconfigured' }),
      orgInviteRevoke: async () => ({ status: 'unconfigured' }),
      orgMemberChangeRole: async () => ({ status: 'unconfigured' }),
      orgMemberRemove: async () => ({ status: 'unconfigured' })
    }
  }
}
