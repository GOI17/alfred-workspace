import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  ConnectCurrentAlfredProfileResult,
  CreateCloudLinkedAlfredProfileResult,
  RefreshCurrentAlfredProfileAuthResult,
  SelectAlfredProfileOrgResult,
  SignOutCurrentAlfredProfileResult
} from '../../../../shared/alfred-profiles'
import type { AppState } from '../types'

export type AlfredProfilesAuthActions = {
  createCloudLinkedAlfredProfile: (args: {
    orgId?: string
    name?: string
  }) => Promise<CreateCloudLinkedAlfredProfileResult | null>
  connectCurrentAlfredProfile: () => Promise<ConnectCurrentAlfredProfileResult | null>
  refreshCurrentAlfredProfileAuth: () => Promise<RefreshCurrentAlfredProfileAuthResult | null>
  signOutCurrentAlfredProfile: () => Promise<SignOutCurrentAlfredProfileResult | null>
  selectAlfredProfileOrg: (orgId: string) => Promise<SelectAlfredProfileOrgResult | null>
}

// Why a separate module: the cloud-auth actions share the profiles slice's
// state keys but form their own cohesive surface (connect/refresh/sign-out/
// org selection), and the combined slice file exceeded the repo line budget.
export const createAlfredProfilesAuthActions: StateCreator<
  AppState,
  [],
  [],
  AlfredProfilesAuthActions
> = (set, get) => {
  let nextConnectAttempt = 0
  let appliedConnectAttempt = 0

  return {
    createCloudLinkedAlfredProfile: async (args) => {
      try {
        const result = await window.api.alfredProfiles.createCloudLinked(args)
        set({
          alfredProfileAuthStatus: result.auth,
          ...(result.status === 'created'
            ? {
                activeAlfredProfileId: result.activeProfileId,
                alfredProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'created') {
          toast.success(
            translate('auto.store.slices.alfred.profiles.319d7cf39b', 'Cloud profile created')
          )
        } else if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.alfred.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.alfred.profiles.f0c9e11a6d',
              'Failed to create cloud profile'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to create Alfred cloud profile:', err)
        toast.error(
          translate(
            'auto.store.slices.alfred.profiles.f0c9e11a6d',
            'Failed to create cloud profile'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    connectCurrentAlfredProfile: async () => {
      const attempt = ++nextConnectAttempt
      try {
        // Why: a pending browser callback must not block retry. Another click
        // starts a second PKCE wait; an older wait is ignored after a newer
        // one has already linked.
        const result = await window.api.alfredProfiles.connectCurrent()
        if (attempt < appliedConnectAttempt) {
          return result
        }
        const alreadyConnected = get().alfredProfileAuthStatus?.state === 'connected'
        set({
          alfredProfileAuthStatus: result.auth,
          ...(result.status === 'connected'
            ? {
                activeAlfredProfileId: result.activeProfileId,
                alfredProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'connected') {
          appliedConnectAttempt = attempt
          if (!alreadyConnected) {
            toast.success(
              translate('auto.store.slices.alfred.profiles.9fcb07a796', 'Profile connected')
            )
          }
        } else if (result.status === 'unconfigured') {
          toast.error(
            translate(
              'auto.store.slices.alfred.profiles.8b8fa73174',
              'Alfred Cloud sign-in is not configured'
            ),
            {
              description: result.auth.setupMessage
            }
          )
        } else if (
          result.status === 'failed' &&
          !alreadyConnected &&
          result.auth.state !== 'connected'
        ) {
          toast.error(
            translate('auto.store.slices.alfred.profiles.33290e88ed', 'Failed to connect profile'),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to connect Alfred profile:', err)
        if (
          attempt >= appliedConnectAttempt &&
          get().alfredProfileAuthStatus?.state !== 'connected'
        ) {
          toast.error(
            translate('auto.store.slices.alfred.profiles.33290e88ed', 'Failed to connect profile'),
            {
              description: err instanceof Error ? err.message : String(err)
            }
          )
        }
        return null
      }
    },

    refreshCurrentAlfredProfileAuth: async () => {
      try {
        const result = await window.api.alfredProfiles.refreshAuth()
        set({
          alfredProfileAuthStatus: result.auth,
          ...(result.status === 'refreshed'
            ? {
                activeAlfredProfileId: result.activeProfileId,
                alfredProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.alfred.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.alfred.profiles.2f6c78a039',
              'Failed to refresh profile auth'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to refresh Alfred profile auth:', err)
        toast.error(
          translate(
            'auto.store.slices.alfred.profiles.2f6c78a039',
            'Failed to refresh profile auth'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    signOutCurrentAlfredProfile: async () => {
      nextConnectAttempt += 1
      appliedConnectAttempt = nextConnectAttempt
      try {
        const result = await window.api.alfredProfiles.signOutCurrent()
        set({
          activeAlfredProfileId: result.activeProfileId,
          alfredProfiles: result.profiles,
          alfredProfileAuthStatus: result.auth
        })
        if (result.auth.state !== 'connected') {
          toast.success(
            translate('auto.store.slices.alfred.profiles.a37b5e6d37', 'Signed out of profile')
          )
        }
        return result
      } catch (err) {
        console.error('Failed to sign out of Alfred profile:', err)
        toast.error(
          translate('auto.store.slices.alfred.profiles.83600521e7', 'Failed to sign out'),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    },

    selectAlfredProfileOrg: async (orgId) => {
      try {
        const result = await window.api.alfredProfiles.selectOrg({ orgId })
        set({
          alfredProfileAuthStatus: result.auth,
          ...(result.status === 'selected'
            ? {
                activeAlfredProfileId: result.activeProfileId,
                alfredProfiles: result.profiles
              }
            : {})
        })
        if (result.status === 'reconnect-required') {
          toast.error(
            translate('auto.store.slices.alfred.profiles.d6e764e7db', 'Reconnect this profile')
          )
        } else if (result.status === 'failed') {
          toast.error(
            translate(
              'auto.store.slices.alfred.profiles.76deec8f58',
              'Failed to switch organization'
            ),
            { description: result.error }
          )
        }
        return result
      } catch (err) {
        console.error('Failed to switch Alfred profile org:', err)
        toast.error(
          translate(
            'auto.store.slices.alfred.profiles.76deec8f58',
            'Failed to switch organization'
          ),
          {
            description: err instanceof Error ? err.message : String(err)
          }
        )
        return null
      }
    }
  }
}
