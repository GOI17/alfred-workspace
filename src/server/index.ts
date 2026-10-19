import { homedir, networkInterfaces } from 'node:os'
import { join, resolve } from 'node:path'
import { mkdir, readFile } from 'node:fs/promises'
import { createApp } from './app.js'
import { tunnelConfig } from './cloudflare.js'
import { loadSecret } from './vault.js'

const directory = resolve(process.env.ALFRED_DATA_DIR || join(homedir(), '.alfred-workspace'))
await mkdir(directory, { recursive: true, mode: 0o700 })
const token =
  process.env.ALFRED_ACCESS_TOKEN ||
  (await loadSecret(directory, 'access.key')).toString('base64url')
const host = process.env.ALFRED_HOST || (process.argv.includes('--share') ? '0.0.0.0' : '127.0.0.1')
const port = Number(process.env.ALFRED_PORT || 4310)
const tls =
  process.env.ALFRED_TLS_CERT && process.env.ALFRED_TLS_KEY
    ? {
        cert: await readFile(process.env.ALFRED_TLS_CERT),
        key: await readFile(process.env.ALFRED_TLS_KEY),
      }
    : undefined
const { app } = await createApp({ directory, token, tunnel: tunnelConfig(process.env), dev: process.argv.includes('--dev'), tls })
await app.listen({ host, port })
const scheme = tls ? 'https' : 'http'
console.log(
  `\n  Alfred Workspace · ${scheme}://localhost:${port}\n  Connection code: ${token}\n`,
)
if (host === '0.0.0.0') {
  for (const addresses of Object.values(networkInterfaces()))
    for (const address of addresses || [])
      if (address.family === 'IPv4' && !address.internal)
        console.log(`  On your phone: ${scheme}://${address.address}:${port}`)
}
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  await app.close()
  process.exit(0)
}
process.on('SIGINT', () => void stop())
process.on('SIGTERM', () => void stop())
