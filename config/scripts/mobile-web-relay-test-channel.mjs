import { once } from 'node:events'
import nacl from 'tweetnacl'
import WebSocket, { WebSocketServer } from 'ws'
import { DeviceRegistry } from '../../src/main/runtime/device-registry'
import { MobileSocketWiring } from '../../src/main/runtime/rpc/mobile-socket-wiring'
import { CloudRelayTransport } from '../../src/main/runtime/rpc/relay-transport'
import { deriveRelayHostId } from '../../src/main/runtime/relay/relay-http-client'
import { SimulatedMobileE2EEV2Peer } from '../../src/main/runtime/relay/simulated-mobile-e2ee-v2-peer'

// A loopback relay substitutes only cloud admission. The desktop transport, device auth and NaCl are real.
export async function openMobileWebRelayTestChannel(directory, dispatch) {
  const relay = new WebSocketServer({ host: '127.0.0.1', port: 0, perMessageDeflate: false })
  await once(relay, 'listening')
  const port = relay.address().port
  let desktopSocket
  let phoneSocket
  let wireFrames = 0
  function splice() {
    if (!desktopSocket || !phoneSocket) {
      return
    }
    desktopSocket.on('message', (data, binary) => {
      wireFrames++
      if (phoneSocket.readyState === WebSocket.OPEN) {
        phoneSocket.send(data, { binary })
      }
    })
    phoneSocket.on('message', (data, binary) => {
      wireFrames++
      if (desktopSocket.readyState === WebSocket.OPEN) {
        desktopSocket.send(data, { binary })
      }
    })
    phoneSocket.send(
      JSON.stringify({
        type: 'relay-hello',
        ok: true,
        credentialKind: 'invite',
        leaseExpiresAt: Date.now() + 600_000
      })
    )
  }
  relay.on('connection', (socket, request) => {
    socket.once('message', (raw) => {
      const auth = JSON.parse(raw.toString())
      if (request.url === '/v1/host/data/connection-1' && auth.connTicket === 'A'.repeat(43)) {
        desktopSocket = socket
      } else if (auth.credential === 'B'.repeat(43)) {
        phoneSocket = socket
      } else {
        return socket.close()
      }
      splice()
    })
  })
  const registry = new DeviceRegistry(directory)
  const device = registry.addDevice('UI test phone', 'mobile')
  const keys = nacl.box.keyPair()
  const relayHostId = deriveRelayHostId(keys.publicKey)
  const wiring = new MobileSocketWiring({
    deviceRegistry: registry,
    e2eeKeypair: { ...keys, publicKeyB64: Buffer.from(keys.publicKey).toString('base64') },
    onText: (socket, text, reply) => {
      if (socket.transport?.transport !== 'relay') {
        throw new Error('not the relay path')
      }
      const request = JSON.parse(text)
      void dispatch(request, (result) => reply(JSON.stringify(result)))
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
  await transport.openConnection({
    connId: 'connection-1',
    connTicket: 'A'.repeat(43),
    kind: 'invite',
    relayDeviceId: device.deviceId,
    attachDeadlineMs: 5000
  })
  const phone = new WebSocket(`ws://127.0.0.1:${port}/v1/connect/${relayHostId}`, {
    perMessageDeflate: false
  })
  await once(phone, 'open')
  const hello = once(phone, 'message')
  phone.send(
    JSON.stringify({ type: 'relay-auth', v: 1, mode: 'connect', credential: 'B'.repeat(43) })
  )
  await hello
  const peer = new SimulatedMobileE2EEV2Peer(nacl.box.keyPair(), keys.publicKey, relayHostId)
  const pending = new Map()
  const streams = new Map()
  let phase = 'ready'
  let connected
  const authenticated = new Promise((resolve) => {
    connected = resolve
  })
  phone.on('message', (raw) => {
    if (phase === 'ready') {
      if (!peer.acceptReady(JSON.parse(raw.toString()))) {
        throw new Error('bad desktop identity')
      }
      phase = 'auth'
      phone.send(
        peer.sealText(
          JSON.stringify({
            type: 'e2ee_auth',
            v: 2,
            transcriptHashB64: peer.transcriptHashB64,
            deviceToken: device.token
          })
        )
      )
      return
    }
    const text = peer.openText(raw.toString())
    if (!text) {
      throw new Error('invalid encrypted frame')
    }
    const result = JSON.parse(text)
    if (phase === 'auth') {
      if (result.type !== 'e2ee_authenticated') {
        throw new Error('authentication failed')
      }
      phase = 'connected'
      connected()
      return
    }
    streams.get(result.id)?.(result.result)
    const settle = pending.get(result.id)
    pending.delete(result.id)
    settle?.(result)
  })
  phone.send(JSON.stringify(peer.hello))
  await authenticated
  let serial = 0
  function send(id, method, params) {
    phone.send(peer.sealText(JSON.stringify({ id, method, params, deviceToken: device.token })))
  }
  const client = {
    sendRequest(method, params) {
      const id = `rpc-${++serial}`
      return new Promise((resolve) => {
        pending.set(id, resolve)
        send(id, method, params)
      })
    },
    subscribe(method, params, callback) {
      const id = `sub-${++serial}`
      streams.set(id, callback)
      send(id, method, params)
      return () => streams.delete(id)
    },
    getState: () => 'connected',
    getReconnectAttempt: () => 0,
    getLastConnectedAt: () => Date.now(),
    getLastInboundAt: () => Date.now(),
    getGeneration: () => 1,
    onStateChange: () => () => {},
    updateTerminalSubscriptionViewport: () => {},
    notifyForeground: () => {},
    close: () => {}
  }
  return {
    client,
    wireFrames: () => wireFrames,
    async close() {
      phone.terminate()
      await transport.stop()
      for (const socket of relay.clients) {
        socket.terminate()
      }
      await new Promise((resolve) => relay.close(resolve))
    }
  }
}
