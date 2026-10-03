import { Platform } from 'react-native'
import { loadHosts, saveHost } from './host-store'
import {
  readMobileRelayCredentialBundle,
  writeMobileRelayCredentialBundle
} from './mobile-relay-credential-bundle'
import { resolvePairingInviteThroughDirector } from './mobile-relay-invite-director'
import {
  clearMobileRelayPairingJournal,
  loadMobileRelayPairingJournal,
  updateMobileRelayPairingJournal
} from './mobile-relay-pairing-journal-store'
import { connectMobileRelayForPairing } from './mobile-relay-physical-client'
import {
  runRecovery,
  type RecoveryDependencies,
  type MobileRelayPairingRecoveryResult
} from './mobile-relay-pairing-reconciliation'
export type { MobileRelayPairingRecoveryResult } from './mobile-relay-pairing-reconciliation'

const defaultDependencies: RecoveryDependencies = {
  loadJournal: loadMobileRelayPairingJournal,
  updateJournal: updateMobileRelayPairingJournal,
  clearJournal: clearMobileRelayPairingJournal,
  readCredentialBundle: readMobileRelayCredentialBundle,
  writeCredentialBundle: writeMobileRelayCredentialBundle,
  loadHosts,
  saveHost,
  connectRelay: connectMobileRelayForPairing,
  resolveInviteDirector: resolvePairingInviteThroughDirector,
  now: Date.now,
  platform: Platform.OS
}

let recoveryPromise: Promise<MobileRelayPairingRecoveryResult> | null = null

export function recoverMobileRelayPairing(
  overrides: Partial<RecoveryDependencies> = {}
): Promise<MobileRelayPairingRecoveryResult> {
  if (recoveryPromise) {
    return recoveryPromise
  }
  const dependencies = { ...defaultDependencies, ...overrides }
  recoveryPromise = runRecovery(dependencies).finally(() => {
    recoveryPromise = null
  })
  return recoveryPromise
}

export function resetMobileRelayPairingRecoveryForTests(): void {
  recoveryPromise = null
}
