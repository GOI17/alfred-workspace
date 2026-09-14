import { ipcMain } from 'electron'
import type { SshConnectionManager } from '../ssh/ssh-connection-manager'
import { browseSshDirectory } from '../ssh/ssh-directory-browse'
export type { RemoteDirEntry } from '../ssh/ssh-directory-browse'

export function registerSshBrowseHandler(
  getConnectionManager: () => SshConnectionManager | null
): void {
  ipcMain.removeHandler('ssh:browseDir')
  ipcMain.handle('ssh:browseDir', async (_event, args: { targetId: string; dirPath: string }) => {
    const manager = getConnectionManager()
    if (!manager) {
      throw new Error('SSH connection manager not initialized')
    }
    const connection = manager.getConnection(args.targetId)
    if (!connection) {
      throw new Error(`SSH connection "${args.targetId}" not found`)
    }
    return browseSshDirectory(connection, args.dirPath)
  })
}
