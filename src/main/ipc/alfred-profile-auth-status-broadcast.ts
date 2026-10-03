import { BrowserWindow } from 'electron'
import { ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL } from '../../shared/alfred-profiles'

export function broadcastAlfredProfileAuthStatusChanged(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    try {
      window.webContents.send(ALFRED_PROFILE_AUTH_STATUS_CHANGED_CHANNEL)
    } catch {
      // A renderer can disappear between isDestroyed() and send().
    }
  }
}
