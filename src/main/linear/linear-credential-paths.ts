import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const LEGACY_WORKSPACE_ID = 'legacy'

function getAlfredDir(): string {
  return join(homedir(), '.alfred')
}

function getLegacyTokenPath(): string {
  return join(getAlfredDir(), 'linear-token.enc')
}

export function getLegacyViewerPath(): string {
  return join(getAlfredDir(), 'linear-viewer.json')
}

export function getWorkspaceFilePath(): string {
  return join(getAlfredDir(), 'linear-workspaces.json')
}

function getWorkspaceTokenDir(): string {
  return join(getAlfredDir(), 'linear-tokens')
}

export function getWorkspaceTokenPath(workspaceId: string): string {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    return getLegacyTokenPath()
  }
  return join(getWorkspaceTokenDir(), `${Buffer.from(workspaceId).toString('base64url')}.enc`)
}

export function ensureAlfredDir(): void {
  const dir = getAlfredDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function ensureWorkspaceTokenDir(): void {
  const dir = getWorkspaceTokenDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
