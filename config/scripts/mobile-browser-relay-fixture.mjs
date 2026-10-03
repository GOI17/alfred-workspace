import { once } from 'node:events'
import { createHash } from 'node:crypto'
import nacl from 'tweetnacl'
import { WebSocketServer } from 'ws'
import { DeviceRegistry } from '../../src/main/runtime/device-registry'
import { MobileSocketWiring } from '../../src/main/runtime/rpc/mobile-socket-wiring'
import { CloudRelayTransport } from '../../src/main/runtime/rpc/relay-transport'
import { deriveRelayHostId } from '../../src/main/runtime/relay/relay-http-client'
import { encodePairingOffer } from '../../src/shared/pairing'

// Cloud admission and credential journal are local fixtures; RPC authentication and encryption are real.
export async function browserRelayFixture(directory, dispatch) {
  const relay = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(relay, 'listening')
  const port = relay.address().port
  const registry = new DeviceRegistry(directory)
  const device = registry.addDevice('Browser test', 'mobile')
  const keys = nacl.box.keyPair()
  const relayHostId = deriveRelayHostId(keys.publicKey)
  const endpoint = {
    v: 1,
    directorUrl: `https://127.0.0.1:${port}`,
    cellUrl: `https://127.0.0.1:${port}`,
    assignmentEpoch: 1,
    relayHostId,
    e2eeFraming: 2
  }
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000
  const pending = new Map()
  const pairs = new Set()
  let serial = 0,
    wireFrames = 0,
    installed,
    tokenHash
  const success = (id, result) => ({
    id,
    ok: true,
    result,
    _meta: { runtimeId: 'browser-fixture' }
  })
  const wiring = new MobileSocketWiring({
    deviceRegistry: registry,
    e2eeKeypair: { ...keys, publicKeyB64: Buffer.from(keys.publicKey).toString('base64') },
    onText: (socket, text, reply) => {
      if (socket.transport?.transport !== 'relay') {
        throw new Error('Expected relay path')
      }
      const request = JSON.parse(text)
      if (request.method === 'pairing.provisionRelay') {
        tokenHash = request.params.newResumeTokenHash
        installed = {
          v: 1,
          reqId: request.params.reqId,
          authorizationMode: 'relay-basis',
          currentVersion: 1,
          resumeExpiresAt: expires
        }
        reply(JSON.stringify(success(request.id, installed)))
      } else if (request.method === 'pairing.getEndpoints') {
        const params = request.params ?? {}
        reply(
          JSON.stringify(
            success(request.id, {
              v: 1,
              relay: endpoint,
              ...(params.installReqId
                ? {
                    installStatus: installed
                      ? { v: 1, reqId: params.installReqId, state: 'committed', result: installed }
                      : { v: 1, reqId: params.installReqId, state: 'not-found' }
                  }
                : {}),
              ...(params.resumeConfirmReqId
                ? {
                    resumeConfirmation: {
                      v: 1,
                      reqId: params.resumeConfirmReqId,
                      currentVersion: 1,
                      acceptedAs: 'current',
                      renewed: false,
                      resumeExpiresAt: expires
                    }
                  }
                : {})
            })
          )
        )
      } else {
        void dispatch(request, (result) => reply(JSON.stringify(result)))
      }
    },
    onBinary: () => {},
    onClose: () => {}
  })
  const transport = new CloudRelayTransport({
    cellUrl: `http://127.0.0.1:${port}`,
    relayHostId,
    generation: 1
  })
  wiring.attachTransport(transport, (socket) => transport.metadataFor(socket))
  await transport.start()
  relay.on('connection', (socket, request) => {
    socket.once('message', (raw) => {
      const auth = JSON.parse(raw.toString())
      if (request.url.startsWith('/v1/host/data/')) {
        const connId = request.url.split('/').at(-1)
        const phone = pending.get(connId)
        if (!phone || auth.connTicket !== 'A'.repeat(43)) {
          socket.close()
          return
        }
        pending.delete(connId)
        const pair = { host: socket, phone: phone.socket }
        pairs.add(pair)
        socket.on('message', (data, binary) => {
          wireFrames++
          if (pair.phone.readyState === 1) {
            pair.phone.send(data, { binary })
          }
        })
        pair.phone.on('message', (data, binary) => {
          wireFrames++
          if (socket.readyState === 1) {
            socket.send(data, { binary })
          }
        })
        socket.on('close', () => {
          pairs.delete(pair)
          pair.phone.close()
        })
        pair.phone.on('close', () => {
          pairs.delete(pair)
          socket.close()
        })
        pair.phone.send(
          JSON.stringify({
            type: 'relay-hello',
            ok: true,
            credentialKind: phone.kind,
            leaseExpiresAt: Date.now() + 600_000,
            ...(phone.kind === 'resume'
              ? { acceptedCredentialVersion: 1, acceptedAs: 'current', resumeExpiresAt: expires }
              : {})
          })
        )
      } else {
        const kind = auth.credential === 'B'.repeat(43) ? 'invite' : 'resume'
        if (
          kind === 'resume' &&
          createHash('sha256').update(auth.credential).digest('base64url') !== tokenHash
        ) {
          socket.close(4403)
          return
        }
        const connId = `browser-${++serial}`
        pending.set(connId, { socket, kind })
        void transport.openConnection({
          connId,
          connTicket: 'A'.repeat(43),
          kind,
          relayDeviceId: device.deviceId,
          attachDeadlineMs: 5000
        })
      }
    })
  })
  return {
    port,
    deviceToken: device.token,
    frames: () => wireFrames,
    connections: () => serial,
    pairingUrl: encodePairingOffer({
      v: 2,
      endpoint: 'ws://127.0.0.1:1',
      deviceToken: device.token,
      publicKeyB64: Buffer.from(keys.publicKey).toString('base64'),
      scope: 'mobile',
      relay: { ...endpoint, inviteToken: 'B'.repeat(43), inviteExpiresAt: Date.now() + 600_000 }
    }),
    interrupt() {
      for (const { phone } of pairs) {
        phone.terminate()
      }
    },
    async close() {
      await transport.stop()
      for (const socket of relay.clients) {
        socket.terminate()
      }
      await new Promise((resolve) => relay.close(resolve))
    }
  }
}
