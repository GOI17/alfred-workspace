import { describe, expect, it, vi } from 'vitest'
import { createRelayApp } from './app.js'
import type { RelayConfig } from './config.js'

describe('public assignment circuit breaker', () => {
  it('rejects assign and resolve without invoking relay state', async () => {
    const assign = vi.fn()
    const resolveResume = vi.fn()
    const app = createRelayApp(config(), {
      store: { resolveResume } as never,
      assignments: { assign } as never,
      drain: vi.fn(),
      ready: vi.fn(async () => true)
    })

    const preflight = await app.request('/v1/resolve', {
      method: 'OPTIONS', headers: { Origin: 'https://alfred.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' }
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*')
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST')
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull()
    expect(resolveResume).not.toHaveBeenCalled()

    for (const path of ['/v1/assign', '/v1/resolve']) {
      const response = await app.request(path, { method: 'POST' })
      expect(response.status).toBe(503)
      expect(response.headers.get('retry-after')).toBe('5')
      expect(await response.json()).toEqual({ error: 'assignments_temporarily_unavailable' })
      expect(response.headers.get('access-control-allow-origin')).toBe(path === '/v1/resolve' ? '*' : null)
    }
    expect(assign).not.toHaveBeenCalled()
    expect(resolveResume).not.toHaveBeenCalled()
    expect((await app.request('/health')).status).toBe(200)
    expect((await app.request('/v1/admin/drain', { method: 'POST' })).status).toBe(401)
    expect((await app.request('/v1/admin/drain', { method: 'OPTIONS', headers: { Origin: 'https://alfred.example' } })).headers.get('access-control-allow-origin')).toBeNull()
  })
})

function config(): RelayConfig {
  return {
    port: 8080,
    publicUrl: 'https://relay.example.test',
    cellUrl: 'https://relay.example.test',
    authIssuer: 'https://auth.example.test',
    authAudience: 'orca-relay',
    jwksUrl: 'https://auth.example.test/jwks',
    assignmentSigningKey: new TextEncoder().encode('assignment-key-with-at-least-32-bytes'),
    role: 'director',
    cellId: 'director',
    cells: [],
    adminAudience: 'https://relay.example.test/v1/admin/drain',
    deployServiceAccount: 'deploy@example.test',
    runtimeServiceAccount: 'runtime@example.test',
    adminJwksUrl: 'https://auth.example.test/jwks',
    databasePoolMax: 3,
    publicAssignmentsEnabled: false,
    publicAssignmentConcurrency: 2,
    publicAssignmentQueueMax: 128,
    publicAssignmentWaitMs: 4_000,
    publicResolveConcurrency: 1,
    publicResolveWaitMs: 5_000,
    publicAssignmentRetryAfterSeconds: 5,
    dataDir: './data'
  }
}
