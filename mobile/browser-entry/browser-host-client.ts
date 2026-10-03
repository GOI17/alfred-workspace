import { connect } from '../src/transport/rpc-client'
import { startPreProfilePairing } from '../src/transport/pre-profile-pairing-attempt'
import { runRecovery } from '../src/transport/mobile-relay-pairing-reconciliation'
import { connectMobileRelayForPairing } from '../src/transport/mobile-relay-physical-client'
import { resolvePairingInviteThroughDirector } from '../src/transport/mobile-relay-invite-director'
import { resolveMobileRelayEndpoint } from '../src/transport/mobile-relay-resume-director'
import { connectMobileRelayRpcSession } from '../src/transport/mobile-relay-rpc-session'
import { createStableLogicalRpcClient } from '../src/transport/stable-logical-rpc-client'
import { MobileEndpointSupervisor } from '../src/transport/mobile-endpoint-supervisor'
import { persistResumeConfirmation } from '../src/transport/mobile-relay-credential-rotation'
import { defaultScheduleTimer, defaultCancelTimer } from '../src/transport/timer-scheduler'
import { waitForAuthenticated } from '../src/transport/replacement-session-authentication'
import {
  dialRelayThroughDirectorFallback,
  persistRelayHost
} from '../src/transport/mobile-endpoint-supervisor-support'
import type { HostProfile, PairingOffer } from '../src/transport/types'
import { BrowserPairingStore } from './browser-pairing-store'

export const browserRandomBytes = (length: number): Uint8Array =>
  crypto.getRandomValues(new Uint8Array(length))

export async function pairBrowserHost(
  offer: PairingOffer,
  store: BrowserPairingStore,
  signal: AbortSignal
): Promise<void> {
  if (offer.scope === 'runtime') {
    throw new Error('Use a mobile pairing code for this browser.')
  }
  const attempt = startPreProfilePairing({
    offer,
    timeoutMs: 45_000,
    relayOnly: Boolean(offer.relay),
    dependencies: {
      connectDirect: connect,
      connectRelay: connectMobileRelayForPairing,
      resolveInviteDirector: resolvePairingInviteThroughDirector,
      resolveHostIdentity: async () => ({ id: `browser-${Date.now()}`, name: 'Desktop' }),
      saveHost: store.saveHost,
      saveJournal: store.saveJournal,
      updateJournal: store.updateJournal,
      clearJournal: store.clearJournal,
      writeCredentialBundle: store.writeBundle,
      now: Date.now,
      platform: 'browser'
    }
  })
  const cancel = () => attempt.dispose()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted) {
    cancel()
  }
  try {
    await attempt.result
  } finally {
    signal.removeEventListener('abort', cancel)
  }
}

export async function recoverBrowserPairing(store: BrowserPairingStore) {
  return runRecovery({
    loadJournal: store.loadJournal,
    updateJournal: store.updateJournal,
    clearJournal: store.clearJournal,
    readCredentialBundle: store.readBundle,
    writeCredentialBundle: store.writeBundle,
    loadHosts: store.loadHosts,
    saveHost: store.saveHost,
    connectRelay: connectMobileRelayForPairing,
    resolveInviteDirector: resolvePairingInviteThroughDirector,
    now: Date.now,
    platform: 'browser'
  })
}

export async function openBrowserHost(host: HostProfile, store: BrowserPairingStore) {
  if (!host.relay) {
    const client = connect(host.endpoint, host.deviceToken, host.publicKeyB64)
    return {
      client,
      close: () => client.close(),
      reconnect: () => client.notifyForeground('network-change')
    }
  }
  const bundle = await store.readBundle(host.id)
  if (!bundle) {
    throw new Error('Pair this browser again from desktop.')
  }
  const openRelay: ConstructorParameters<typeof MobileEndpointSupervisor>[2]['openRelay'] = (
    relay,
    credential,
    confirmReqId,
    onHostCloseReason
  ) =>
    connectMobileRelayRpcSession({
      relay,
      resumeToken: credential.token,
      resumeCredentialVersion: credential.version,
      resumeConfirmReqId: confirmReqId,
      deviceToken: host.deviceToken,
      desktopPublicKeyB64: host.publicKeyB64,
      onHostCloseReason
    })
  let physical: ReturnType<typeof openRelay> | undefined
  const dialed = await dialRelayThroughDirectorFallback({
    resumeToken: bundle.current.token,
    relay: () => host.relay,
    resolveRelay: resolveMobileRelayEndpoint,
    persistResolvedRelay: async (relay) => {
      host = await persistRelayHost(host, relay, store.saveHost)
    },
    dial: async () => {
      if (!host.relay) {
        return { ok: false, error: new Error('Missing relay endpoint') }
      }
      const candidate = openRelay(host.relay, bundle.current, `browser-${crypto.randomUUID()}`)
      try {
        await waitForAuthenticated(candidate, 30_000)
        await persistResumeConfirmation({
          session: candidate,
          bundle,
          usedCredentialVersion: bundle.current.version,
          writeBundle: store.writeBundle
        })
        physical = candidate
        return { ok: true }
      } catch (error) {
        candidate.close()
        return {
          ok: false,
          error:
            candidate.getFailure() ??
            (error instanceof Error ? error : new Error('Relay connection failed'))
        }
      }
    }
  })
  if (!dialed.ok) {
    throw dialed.error
  }
  if (!physical) {
    throw new Error('Relay connection did not complete')
  }
  const client = createStableLogicalRpcClient(physical, 'relay')
  const supervisor = new MobileEndpointSupervisor(client, host, {
    relayOnly: true,
    initialRelaySession: physical,
    openDirect: (endpoint) => connect(endpoint, host.deviceToken, host.publicKeyB64),
    openRelay,
    resolveRelay: resolveMobileRelayEndpoint,
    readBundle: store.readBundle,
    writeBundle: store.writeBundle,
    saveHost: store.saveHost,
    now: Date.now,
    randomBytes: browserRandomBytes,
    setTimer: defaultScheduleTimer,
    clearTimer: defaultCancelTimer
  })
  void supervisor.start()
  const foreground = () => {
    supervisor.setForeground(!document.hidden)
    if (!document.hidden) {
      supervisor.nudge('app-resume')
    }
  }
  document.addEventListener('visibilitychange', foreground)
  return {
    client,
    reconnect: () => supervisor.nudge('network-change'),
    close() {
      document.removeEventListener('visibilitychange', foreground)
      supervisor.stop()
      client.close()
    }
  }
}
