import {
  MobileRelayCredentialBundleSchema,
  type MobileRelayCredentialBundle
} from './mobile-relay-credential-schema'
export {
  MobileRelayCredentialBundleSchema,
  promotePairingJournalCredential,
  type MobileRelayCredentialBundle
} from './mobile-relay-credential-schema'
import { Platform } from 'react-native'
import {
  deletePairingKeychainItem,
  readPairingKeychainItem,
  writePairingKeychainItem
} from './pairing-keychain'
import { markHostCredentialWrite } from './host-credential-write-revision'

function credentialKey(hostId: string): string {
  return `orca.mobile-relay.credentials.${hostId}`
}

export async function readMobileRelayCredentialBundle(
  hostId: string
): Promise<MobileRelayCredentialBundle | null> {
  requireNativeSecretStore()
  const raw = await readPairingKeychainItem(credentialKey(hostId))
  if (raw === null) {
    return null
  }
  try {
    const result = MobileRelayCredentialBundleSchema.safeParse(JSON.parse(raw))
    return result.success && result.data.hostId === hostId ? result.data : null
  } catch {
    return null
  }
}

export async function writeMobileRelayCredentialBundle(
  bundle: MobileRelayCredentialBundle
): Promise<void> {
  requireNativeSecretStore()
  const validated = MobileRelayCredentialBundleSchema.parse(bundle)
  markHostCredentialWrite(validated.hostId)
  await writePairingKeychainItem(credentialKey(validated.hostId), JSON.stringify(validated))
}

export async function deleteMobileRelayCredentialBundle(hostId: string): Promise<void> {
  if (Platform.OS === 'web') {
    return
  }
  await deletePairingKeychainItem(credentialKey(hostId))
}

function requireNativeSecretStore(): void {
  if (Platform.OS === 'web') {
    throw new Error('Orca Relay credentials require a native secret store')
  }
}
