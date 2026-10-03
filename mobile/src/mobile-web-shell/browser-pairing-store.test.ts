import { describe, expect, it, vi } from 'vitest'
import { BrowserPairingStore } from '../../browser-entry/browser-pairing-store'
import { createMobileRelayPairingJournal } from '../transport/mobile-relay-pairing-journal'

vi.mock('expo-crypto', () => ({ getRandomBytes: vi.fn() }))

function tabStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null
  }
}

const host = {
  id: 'desktop',
  name: 'Desktop',
  endpoint: 'ws://127.0.0.1:6768',
  deviceToken: 'paired-device',
  publicKeyB64: 'A'.repeat(43) + '=',
  lastConnected: 0
}

describe('browser pairing storage', () => {
  it('restores the same tab, isolates another tab and refuses late writes after forgetting', async () => {
    const storage = tabStorage()
    const store = new BrowserPairingStore(storage)
    await store.saveHost(host)
    expect(new BrowserPairingStore(storage).read().host).toEqual(host)
    expect(new BrowserPairingStore(tabStorage()).read().host).toBeUndefined()
    store.clear()
    await expect(store.saveHost(host)).rejects.toThrow('forgotten')
    expect(new BrowserPairingStore(storage).read().host).toBeUndefined()
  })

  it('does not erase malformed or inaccessible durable state', () => {
    const storage = tabStorage()
    storage.setItem('alfred.browser-pairing.v1', '{broken')
    expect(() => new BrowserPairingStore(storage).read()).toThrow()
    expect(storage.getItem('alfred.browser-pairing.v1')).toBe('{broken')
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => new BrowserPairingStore(storage).read()).toThrow('blocked')
  })

  it('preserves an authorized journal until its matching recovery completes', async () => {
    const store = new BrowserPairingStore(tabStorage())
    const journal = createMobileRelayPairingJournal({
      hostId: host.id,
      hostName: host.name,
      offer: {
        v: 2,
        ...host,
        relay: {
          v: 1,
          directorUrl: 'https://director.example',
          cellUrl: 'https://cell.example',
          relayHostId: 'AbCdEf0123_-xyZ9',
          assignmentEpoch: 1,
          e2eeFraming: 2,
          inviteToken: 'B'.repeat(43),
          inviteExpiresAt: Date.now() + 60_000
        }
      },
      randomBytes: (length) => new Uint8Array(length).fill(1)
    })
    journal.metadata.authorizationMode = 'relay-basis'
    await store.saveJournal(journal)
    await expect(store.saveJournal(journal)).rejects.toThrow('recovery is pending')
    await expect(store.clearJournal('another-journal')).rejects.toThrow('replaced')
    expect(await store.loadJournal()).toEqual(journal)
    await store.clearJournal(journal.metadata.journalId)
    expect(await store.loadJournal()).toBeNull()
  })
})
