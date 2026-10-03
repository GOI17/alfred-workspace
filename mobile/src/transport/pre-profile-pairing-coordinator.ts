import { Platform } from 'react-native'
import { connect } from './rpc-client'
import { resolvePairingHostIdentity, saveHost } from './host-store'
import {
  clearMobileRelayPairingJournal,
  saveMobileRelayPairingJournal,
  updateMobileRelayPairingJournal
} from './mobile-relay-pairing-journal-store'
import { writeMobileRelayCredentialBundle } from './mobile-relay-credential-bundle'
import { connectMobileRelayForPairing } from './mobile-relay-physical-client'
import { resolvePairingInviteThroughDirector } from './mobile-relay-invite-director'
import {
  startPreProfilePairing as startPairingAttempt,
  type PairingAttemptDependencies
} from './pre-profile-pairing-attempt'
export type { PreProfilePairingAttempt } from './pre-profile-pairing-attempt'

const defaultDependencies: PairingAttemptDependencies = {
  connectDirect: connect,
  connectRelay: connectMobileRelayForPairing,
  resolveInviteDirector: resolvePairingInviteThroughDirector,
  resolveHostIdentity: resolvePairingHostIdentity,
  saveHost,
  saveJournal: saveMobileRelayPairingJournal,
  updateJournal: updateMobileRelayPairingJournal,
  clearJournal: clearMobileRelayPairingJournal,
  writeCredentialBundle: writeMobileRelayCredentialBundle,
  now: Date.now,
  platform: Platform.OS
}

export function startPreProfilePairing(
  args: Omit<Parameters<typeof startPairingAttempt>[0], 'dependencies' | 'relayOnly'> & {
    dependencies?: Partial<PairingAttemptDependencies>
  }
) {
  return startPairingAttempt({
    ...args,
    dependencies: { ...defaultDependencies, ...args.dependencies }
  })
}
