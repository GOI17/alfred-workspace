import { timingSafeEqual, createHmac } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'

function matches(left: string, right: string) {
  const a = Buffer.from(left),
    b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}
export async function authentication(app: FastifyInstance, token: string, publicOrigin?: string) {
  await app.register(cookie)
  await app.register(rateLimit, { global: false })
  const session = createHmac('sha256', token).update('alfred-session-v1').digest('hex')
  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY')
    if (!request.url.startsWith('/api/')) return
    reply.header('Cache-Control', 'no-store')
    const origin = request.headers.origin
    const remote = publicOrigin && request.headers.host === new URL(publicOrigin).host
    const expected = remote ? publicOrigin : `${request.protocol}://${request.headers.host}`
    if ((origin && origin !== expected) || (request.headers.upgrade && !origin))
      return reply.code(403).send({ error: 'Origen no permitido.' })
    if (request.url.split('?')[0] === '/api/auth') return
    if (!matches(request.cookies.alfred_session || '', session))
      return reply.code(401).send({ error: 'Connect this device using the server code.' })
  })
  app.post(
    '/api/auth',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { code } = z.object({ code: z.string().max(200) }).parse(request.body)
      if (!matches(code, token)) return reply.code(401).send({ error: 'Incorrect code.' })
      reply.setCookie('alfred_session', session, {
        httpOnly: true,
        sameSite: 'strict',
        secure: request.protocol === 'https' || Boolean(publicOrigin && request.headers.host === new URL(publicOrigin).host),
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
      return { ok: true }
    },
  )
  app.delete('/api/auth', async (_request, reply) => {
    reply.clearCookie('alfred_session', { path: '/' })
    return { ok: true }
  })
}
