import { expect, it } from 'vitest'
import { createBridgeHost } from './bridge-host'
import { bridgeId, createFakeRpcClient } from './bridge-host-test-fakes'
import { bindMobileWebRequestClient } from './bridge-request-client'

it('keeps the pairing credential native while binding page input and subscriptions to it', () => {
  const client = createFakeRpcClient()
  const frames: string[] = []
  const host = createBridgeHost({
    client,
    clientId: 'pairing-secret',
    sessionId: 'page-session',
    buildId: 'build',
    host: { id: 'selected-host', name: 'Desktop' },
    post: async (json) => {
      frames.push(json)
    }
  })
  host.receive(JSON.stringify({ v: 1, type: 'ready' }))
  expect(frames.join()).not.toContain('pairing-secret')
  expect(JSON.parse(frames[0]!)).toMatchObject({
    clientId: 'shell:page-session',
    host: { id: 'selected-host' }
  })
  const params = {
    terminal: 'term-1',
    text: 'pwd',
    client: { id: 'shell:page-session', type: 'mobile' }
  }
  host.receive(
    JSON.stringify({ v: 1, type: 'request', id: bridgeId(1), method: 'terminal.send', params })
  )
  host.receive(
    JSON.stringify({
      v: 1,
      type: 'subscribe',
      id: bridgeId(2),
      method: 'terminal.subscribe',
      params
    })
  )
  expect(client.requests[0]?.args[1]).toEqual({
    ...params,
    client: { id: 'pairing-secret', type: 'mobile' }
  })
  expect(client.streams[0]?.params).toEqual({
    ...params,
    client: { id: 'pairing-secret', type: 'mobile' }
  })
  host.dispose()
})

it('does not rewrite unrelated RPC params or invent client identity on older shells', () => {
  for (const params of [
    undefined,
    null,
    {},
    { client: 'opaque' },
    { client: { type: 'desktop', id: 'other' } }
  ]) {
    expect(bindMobileWebRequestClient(params, 'secret')).toBe(params)
  }
  const params = { client: { type: 'mobile', id: 'alias' } }
  expect(bindMobileWebRequestClient(params, undefined)).toBe(params)
  expect(bindMobileWebRequestClient({ mobileClient: params.client }, 'secret')).toEqual({
    mobileClient: { type: 'mobile', id: 'secret' }
  })
})
