import type { StateCreator } from 'zustand'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type {
  AlfredProfileAuthStatus,
  AlfredProfileSummary,
  SwitchAlfredProfileResult,
  TransferAlfredProfileProjectArgs,
  TransferAlfredProfileProjectResult
} from '../../../../shared/alfred-profiles'
import type { AppState } from '../types'
import {
  createAlfredProfilesAuthActions,
  type AlfredProfilesAuthActions
} from './alfred-profiles-auth-actions'

export type AlfredProfilesSlice = AlfredProfilesAuthActions & {
  alfredProfiles: AlfredProfileSummary[]
  activeAlfredProfileId: string | null
  alfredProfileAuthStatus: AlfredProfileAuthStatus | null
  alfredProfilesMultiProfileUi: boolean
  alfredProfilesLoading: boolean
  alfredProfileSwitching: boolean
  fetchAlfredProfiles: () => Promise<void>
  fetchAlfredProfileAuthStatus: () => Promise<AlfredProfileAuthStatus | null>
  createLocalAlfredProfile: (name?: string) => Promise<AlfredProfileSummary | null>
  switchAlfredProfile: (profileId: string) => Promise<SwitchAlfredProfileResult | null>
  transferAlfredProfileProject: (
    args: TransferAlfredProfileProjectArgs
  ) => Promise<TransferAlfredProfileProjectResult | null>
}

export const createAlfredProfilesSlice: StateCreator<AppState, [], [], AlfredProfilesSlice> = (
  set,
  get,
  api
) => ({
  alfredProfiles: [],
  activeAlfredProfileId: null,
  alfredProfileAuthStatus: null,
  alfredProfilesMultiProfileUi: false,
  alfredProfilesLoading: false,
  alfredProfileSwitching: false,

  fetchAlfredProfiles: async () => {
    set({ alfredProfilesLoading: true })
    try {
      const [state, authStatus] = await Promise.all([
        window.api.alfredProfiles.list(),
        window.api.alfredProfiles.authStatus()
      ])
      set({
        activeAlfredProfileId: state.activeProfileId,
        alfredProfiles: state.profiles,
        alfredProfilesMultiProfileUi: state.multiProfileUi,
        alfredProfileAuthStatus: authStatus,
        alfredProfilesLoading: false
      })
    } catch (err) {
      console.error('Failed to fetch Alfred profiles:', err)
      set({ alfredProfilesLoading: false })
    }
  },

  fetchAlfredProfileAuthStatus: async () => {
    try {
      const authStatus = await window.api.alfredProfiles.authStatus()
      set({ alfredProfileAuthStatus: authStatus })
      return authStatus
    } catch (err) {
      console.error('Failed to fetch Alfred profile auth status:', err)
      return null
    }
  },

  createLocalAlfredProfile: async (name) => {
    try {
      const state = await window.api.alfredProfiles.createLocal({ name })
      set({
        activeAlfredProfileId: state.activeProfileId,
        alfredProfiles: state.profiles
      })
      void get().fetchAlfredProfileAuthStatus()
      return state.profile
    } catch (err) {
      console.error('Failed to create Alfred profile:', err)
      toast.error(
        translate('auto.store.slices.alfred.profiles.612f7f6861', 'Failed to create profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  ...createAlfredProfilesAuthActions(set, get, api),

  switchAlfredProfile: async (profileId) => {
    if (!profileId || profileId === get().activeAlfredProfileId) {
      return { status: 'already-active' }
    }
    set({ alfredProfileSwitching: true })
    try {
      const result = await window.api.alfredProfiles.switchProfile({ profileId })
      if (result?.status !== 'relaunching') {
        // Why: only a relaunch may keep the switcher locked; a stale
        // "already-active" answer would otherwise disable it forever.
        set({ alfredProfileSwitching: false })
      }
      return result
    } catch (err) {
      console.error('Failed to switch Alfred profile:', err)
      set({ alfredProfileSwitching: false })
      toast.error(
        translate('auto.store.slices.alfred.profiles.7d4bc516ee', 'Failed to switch profile'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  },

  transferAlfredProfileProject: async (args) => {
    try {
      const result = await window.api.alfredProfiles.transferProject(args)
      if (result.status === 'duplicate-target') {
        toast.error(
          translate(
            'auto.store.slices.alfred.profiles.f518e89aa5',
            'Project already exists in that profile'
          )
        )
      }
      if (result.status === 'transferred' && result.willRelaunch) {
        set({ alfredProfileSwitching: true })
      }
      return result
    } catch (err) {
      console.error('Failed to transfer Alfred profile project:', err)
      toast.error(
        translate('auto.store.slices.alfred.profiles.f03ae7f27b', 'Failed to transfer project'),
        {
          description: err instanceof Error ? err.message : String(err)
        }
      )
      return null
    }
  }
})
