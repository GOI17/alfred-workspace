import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import type { WorkspaceService } from './service.js'

const clientId = 'Iv1.b507a08c87ecfe98'
export const copilotHeaders = {
  'Editor-Version': 'vscode/1.95.0',
  'Editor-Plugin-Version': 'copilot-chat/0.22.0',
  'Copilot-Integration-Id': 'vscode-chat',
}
export async function copilotToken(githubToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/copilot_internal/v2/token', {
    headers: { ...copilotHeaders, Authorization: `Bearer ${githubToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Could not authorize Copilot. Check your GitHub subscription and organization policy.')
  return z.object({ token: z.string().min(1) }).parse(await response.json()).token
}
export function copilotRoutes(app: FastifyInstance, service: WorkspaceService) {
  const pending = new Map<string, { code: string; expires: number; next: number; interval: number; busy: boolean }>()
  app.addHook('onClose', async () => { pending.clear() })
  app.post('/api/copilot/authorize', async () => {
    for (const [id, flow] of pending) if (flow.expires < Date.now()) pending.delete(id)
    if (pending.size >= 5) throw new Error('Too many pending authorizations. Wait for them to expire.')
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, scope: 'read:user' }), signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Could not start GitHub authorization.')
    const data = z.object({ device_code: z.string(), user_code: z.string(), expires_in: z.number().positive(), interval: z.number().positive().default(5) }).parse(await response.json())
    const id = randomUUID()
    pending.set(id, { code: data.device_code, expires: Date.now() + data.expires_in * 1000, next: Date.now() + data.interval * 1000, interval: data.interval * 1000, busy: false })
    return { id, code: data.user_code, url: 'https://github.com/login/device' }
  })
  app.post('/api/copilot/poll', async (request) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.body)
    const flow = pending.get(id)
    if (!flow || flow.expires < Date.now()) { pending.delete(id); throw new Error('Authorization expired. Connect again.') }
    if (flow.busy || Date.now() < flow.next) return { connected: false }
    flow.busy = true
    flow.next = Date.now() + flow.interval
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, device_code: flow.code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Could not check GitHub authorization.')
      const data = z.object({ access_token: z.string().optional(), error: z.string().optional() }).parse(await response.json())
      if (data.error === 'slow_down') { flow.interval += 5000; flow.next = Date.now() + flow.interval; return { connected: false } }
      if (data.error === 'authorization_pending') return { connected: false }
      if (!data.access_token) { pending.delete(id); throw new Error('GitHub authorization was denied or expired.') }
      pending.delete(id)
      await copilotToken(data.access_token)
      const encryptedKey = service.vault.encrypt(data.access_token)
      await service.store.update((db) => {
        const model = db.providers.find((item) => item.id === 'copilot')?.model || 'gpt-4o'
        db.providers = [...db.providers.filter((item) => item.id !== 'copilot'), { id: 'copilot', model, encryptedKey }]
      })
      service.changed()
      return { connected: true }
    } finally { flow.busy = false }
  })
}
