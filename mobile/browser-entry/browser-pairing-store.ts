import { z } from 'zod'
import { HostProfileSchema, type HostProfile } from '../src/transport/types'
import {
  MobileRelayCredentialBundleSchema,
  type MobileRelayCredentialBundle
} from '../src/transport/mobile-relay-credential-schema'
import {
  MobileRelayPairingJournalMetadataSchema,
  MobileRelayPairingJournalSecretsSchema,
  type MobileRelayPairingJournal,
  type MobileRelayPairingJournalMetadata
} from '../src/transport/mobile-relay-pairing-journal'

const KEY = 'alfred.browser-pairing.v1'
const StateSchema = z.object({
  host: HostProfileSchema.optional(),
  bundle: MobileRelayCredentialBundleSchema.optional(),
  journal: z
    .object({
      metadata: MobileRelayPairingJournalMetadataSchema,
      secrets: MobileRelayPairingJournalSecretsSchema
    })
    .optional()
})

// Tab-scoped secrets stay in the trusted loader, outside the opaque host UI frame.
export class BrowserPairingStore {
  private forgotten = false
  constructor(private readonly storage: Storage) {}

  read() {
    const raw = this.storage.getItem(KEY)
    return raw === null ? StateSchema.parse({}) : StateSchema.parse(JSON.parse(raw))
  }

  private write(next: z.infer<typeof StateSchema>) {
    if (this.forgotten) {
      throw new Error('This pairing was forgotten. Start a new pairing attempt.')
    }
    this.storage.setItem(KEY, JSON.stringify(StateSchema.parse(next)))
  }

  saveHost = async (host: HostProfile): Promise<void> => {
    this.write({ ...this.read(), host })
  }
  loadHosts = async (): Promise<HostProfile[]> => {
    const host = this.read().host
    return host ? [host] : []
  }
  writeBundle = async (bundle: MobileRelayCredentialBundle): Promise<void> => {
    this.write({ ...this.read(), bundle })
  }
  readBundle = async (hostId: string): Promise<MobileRelayCredentialBundle | null> => {
    const bundle = this.read().bundle
    return bundle?.hostId === hostId ? bundle : null
  }
  loadJournal = async (): Promise<MobileRelayPairingJournal | null> => this.read().journal ?? null
  saveJournal = async (journal: MobileRelayPairingJournal): Promise<void> => {
    const current = this.read()
    if (current.journal?.metadata.authorizationMode) {
      throw new Error('Pairing recovery is pending. Retry before pairing again.')
    }
    this.write({ ...current, journal })
  }
  updateJournal = async (
    id: string,
    update: (metadata: MobileRelayPairingJournalMetadata) => MobileRelayPairingJournalMetadata
  ): Promise<void> => {
    const current = this.read()
    if (!current.journal || current.journal.metadata.journalId !== id) {
      throw new Error('Pairing was replaced')
    }
    this.write({
      ...current,
      journal: { ...current.journal, metadata: update(current.journal.metadata) }
    })
  }
  clearJournal = async (id: string): Promise<void> => {
    const current = this.read()
    if (current.journal && current.journal.metadata.journalId !== id) {
      throw new Error('Pairing was replaced')
    }
    this.write({ ...current, journal: undefined })
  }
  clear(): void {
    this.storage.removeItem(KEY)
    this.forgotten = true
  }
}
