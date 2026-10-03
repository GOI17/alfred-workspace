import { ipcRenderer } from 'electron'
import type { PreloadApi } from '../api-types'
import { ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL } from '../../shared/alfred-profiles'

export const alfredProfilesApi = {
  list: () => ipcRenderer.invoke('alfredProfiles:list'),
  authStatus: () => ipcRenderer.invoke('alfredProfiles:authStatus'),
  onAuthStatusChanged: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on(ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
    return () => ipcRenderer.removeListener(ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL, listener)
  },
  createLocal: (args) => ipcRenderer.invoke('alfredProfiles:createLocal', args),
  createCloudLinked: (args) => ipcRenderer.invoke('alfredProfiles:createCloudLinked', args),
  switchProfile: (args) => ipcRenderer.invoke('alfredProfiles:switch', args),
  transferProject: (args) => ipcRenderer.invoke('alfredProfiles:transferProject', args),
  findProjectProfiles: (args) => ipcRenderer.invoke('alfredProfiles:findProjectProfiles', args),
  connectCurrent: () => ipcRenderer.invoke('alfredProfiles:connectCurrent'),
  refreshAuth: () => ipcRenderer.invoke('alfredProfiles:refreshAuth'),
  signOutCurrent: () => ipcRenderer.invoke('alfredProfiles:signOutCurrent'),
  selectOrg: (args) => ipcRenderer.invoke('alfredProfiles:selectOrg', args),
  orgMembersList: (args) => ipcRenderer.invoke('alfredProfiles:orgMembersList', args),
  orgMemberInvite: (args) => ipcRenderer.invoke('alfredProfiles:orgMemberInvite', args),
  orgInviteRevoke: (args) => ipcRenderer.invoke('alfredProfiles:orgInviteRevoke', args),
  orgMemberChangeRole: (args) => ipcRenderer.invoke('alfredProfiles:orgMemberChangeRole', args),
  orgMemberRemove: (args) => ipcRenderer.invoke('alfredProfiles:orgMemberRemove', args)
} satisfies PreloadApi['alfredProfiles']
