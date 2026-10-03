import type { HostProfile } from './types'
import { mobileWebEntryPath } from '../mobile-web-shell/bridge/mobile-web-entry-path'

let shellHost: HostProfile | null = null
let shellEntryPath: string | undefined

// Presentation only: pairing secrets and endpoint selection stay in the native container.
export function setShellHost(host: { id: string; name: string }, initialPath?: string): void {
  shellHost = { ...host, endpoint: '', deviceToken: '', publicKeyB64: '', lastConnected: 0 }
  shellEntryPath = mobileWebEntryPath(host.id, initialPath)
}

export async function loadHosts(): Promise<HostProfile[]> {
  return shellHost ? [shellHost] : []
}

export function getShellHostPath(): string | undefined {
  return shellEntryPath
}

export async function updateLastConnected(): Promise<void> {}

export async function updateHostNameAndEndpoint(): Promise<void> {
  throw new Error('Return to the native app to edit this host.')
}

export async function removeHost(): Promise<void> {
  throw new Error('Return to the native app to remove this host.')
}
