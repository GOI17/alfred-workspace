import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { registerMobileHandlers } from './mobile'
import { OrcaRuntimeService } from '../runtime/orca-runtime'
import { OrcaRuntimeRpcServer } from '../runtime/runtime-rpc'

const handlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>())
vi.mock('electron', () => ({
  app: { isPackaged: false },
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      handlers.set(channel, handler)
  },
  shell: { openExternal: vi.fn() }
}))

describe('browser pairing invitation', () => {
  it('encodes browser access in the QR fragment and rejects an insecure entry before minting', async () => {
    const userDataPath = mkdtempSync(join(tmpdir(), 'orca-browser-ipc-'))
    const server = new OrcaRuntimeRpcServer({
      runtime: new OrcaRuntimeService(),
      userDataPath,
      enableWebSocket: true,
      wsPort: 0
    })
    await server.start()
    const pairingUrl = 'orca://pair#secret-offer'
    const mint = vi.spyOn(server, 'createMobilePairingOffer').mockResolvedValue({
      available: true,
      pairingUrl,
      endpoint: 'ws://127.0.0.1:6768',
      deviceId: 'browser',
      webClientUrl: null,
      connectionMode: 'automatic'
    })
    const encodePairingQr = vi
      .fn()
      .mockResolvedValue({ ok: true, qrDataUrl: 'data:image/png;base64,test', qrSize: 288 })
    try {
      registerMobileHandlers(server, { encodePairingQr })
      await expect(
        handlers.get('mobile:getPairingQR')?.(null, {
          browserEntryUrl: 'http://public.example/mobile-browser.html'
        })
      ).resolves.toMatchObject({ available: false })
      expect(mint).not.toHaveBeenCalled()
      const browserUrl = `https://alfred.example/mobile-browser.html#${new URLSearchParams({ pairing: pairingUrl })}`
      await expect(
        handlers.get('mobile:getPairingQR')?.(null, {
          browserEntryUrl: 'https://alfred.example/mobile-browser.html',
          connectionMode: 'automatic'
        })
      ).resolves.toMatchObject({ available: true, browserUrl, pairingUrl })
      expect(encodePairingQr).toHaveBeenCalledWith(browserUrl)
    } finally {
      await server.stop()
      rmSync(userDataPath, { recursive: true, force: true })
    }
  })
})
