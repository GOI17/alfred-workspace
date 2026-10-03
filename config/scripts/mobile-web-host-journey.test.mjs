import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { afterAll, expect, it } from 'vitest'
import { _electron as electron } from 'playwright-core'
import { writeMobileWebBundleTree, sha256Hex } from './build-mobile-web-bundle.mjs'
import { buildMobileWebAppBundle } from './build-mobile-web-app-bundle.mjs'
import { mobileWebAppDependenciesPresent } from './mobile-web-app-bundle-dependencies.mjs'
import { openMobileWebRelayTestChannel } from './mobile-web-relay-test-channel.mjs'
import { mobileWebJourneyTestRuntime } from './mobile-web-journey-test-runtime.mjs'
import {
  installMobileWebBundleAppPath,
  mobileWebBundleDispatcher
} from '../../src/main/runtime/rpc/methods/mobile-web-bundle.test-fixture'
import { fetchMobileWebBundle } from '../../mobile/src/transport/mobile-web-bundle-fetch'
import { createBridgeHost } from '../../mobile/src/mobile-web-shell/bridge-host'
import { readShellCsp } from './mobile-web-shell-test-policy.mjs'
import { createServer } from 'node:http'

const require = createRequire(import.meta.url)
const enabled = mobileWebAppDependenciesPresent()
const evidenceDir = fileURLToPath(new URL('../../out/mobile-web-validation/', import.meta.url))
let scratch, relay, app, server, bridge

afterAll(async () => {
  bridge?.dispose()
  await app?.close()
  server?.close()
  await relay?.close()
  if (scratch) {
    await rm(scratch, { recursive: true, force: true })
  }
})

it.skipIf(!enabled)(
  'downloads the shipped UI over authenticated E2EE relay, opens a workspace and executes terminal input',
  async () => {
    await mkdir(evidenceDir, { recursive: true })
    scratch = await mkdtemp(join(tmpdir(), 'orca-host-ui-journey-'))
    const built = await buildMobileWebAppBundle({ outDir: join(scratch, 'out', 'mobile-web') })
    installMobileWebBundleAppPath(scratch)
    const dispatcher = mobileWebBundleDispatcher()
    const execution = mobileWebJourneyTestRuntime(scratch)
    relay = await openMobileWebRelayTestChannel(scratch, async (request, reply) => {
      if (request.method.startsWith('mobileWeb.bundle.')) {
        reply(
          await dispatcher.dispatch(
            { ...request, authToken: 'test-token' },
            { connectionId: 'relay-ui-test' }
          )
        )
      } else {
        await execution.dispatch(request, reply)
      }
    })
    let downloaded = await fetchMobileWebBundle({ client: relay.client })
    expect(downloaded.manifest.buildId).toBe(built.manifest.buildId)
    expect(downloaded.assets.size).toBe(built.manifest.assets.length)
    expect(relay.wireFrames()).toBeGreaterThan(100)

    // The renderer can read only downloaded bytes. This listener models the native local asset handler.
    const csp = await readShellCsp()
    server = createServer((request, response) => {
      const pathname = new URL(request.url, 'http://localhost').pathname
      const path = pathname.includes('.') ? pathname.slice(1) : 'index.html'
      const asset = downloaded.manifest.assets.find((entry) => entry.path === path)
      if (!asset) {
        response.writeHead(404)
        response.end()
        return
      }
      response.setHeader('Content-Type', asset.contentType)
      if (path === 'index.html') {
        response.setHeader('Content-Security-Policy', csp)
      }
      response.end(downloaded.assets.get(path))
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const main = join(scratch, 'hidden-renderer.cjs')
    await writeFile(
      main,
      `const { app, BrowserWindow } = require('electron');
    app.on('window-all-closed', () => app.quit());
    app.whenReady().then(() => { global.window = new BrowserWindow({ show: false, width: 390, height: 844,
      webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } }); global.window.loadURL('about:blank'); });`
    )
    app = await electron.launch({
      executablePath: require('electron'),
      args: [main],
      env: { ...process.env, ORCA_BACKGROUND_LAUNCH: '1' }
    })
    const page = await app.firstWindow()
    expect(
      await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().every((window) => !window.isVisible())
      )
    ).toBe(true)
    const errors = []
    const pageSockets = []
    page.on('websocket', (socket) => pageSockets.push(socket.url()))
    page.on('pageerror', (error) => errors.push(error.message))
    const attachBridge = (buildId, sessionId, initialPath) =>
      createBridgeHost({
        client: relay.client,
        buildId,
        sessionId,
        host: { id: 'relay-host', name: 'Paired desktop' },
        clientId: 'native-client-1',
        initialPath,
        post: (json) => page.evaluate((data) => globalThis.orcaBridge?.onmessage?.({ data }), json)
      })
    bridge = attachBridge(built.manifest.buildId, 'journey-session')
    await page.exposeFunction('postToNative', (json) => bridge.receive(json))
    await page.addInitScript(() => {
      // Native only serves the root document; custom-scheme history rewrites are not portable.
      history.pushState = history.replaceState = () => {
        throw new Error('The shell must keep its document URL unchanged')
      }
      globalThis.orcaBridge = {
        postMessage: (json) => {
          void globalThis.postToNative(json)
        },
        onmessage: null
      }
    })
    await page.goto(`http://127.0.0.1:${server.address().port}/`)
    await page.getByText('Relay workspace', { exact: true }).first().waitFor({ timeout: 30_000 })
    await page.screenshot({ path: join(evidenceDir, 'workspaces.png') })
    await page.getByText('Relay workspace', { exact: true }).last().click()
    await page.locator('.xterm-screen').waitFor({ timeout: 30_000 })
    expect(new URL(page.url()).pathname).toBe('/')
    await page.getByText('Live input', { exact: true }).click()
    await page.keyboard.insertText('orca-ui-proof')
    await page.getByText('Enter', { exact: true }).click()
    await expect
      .poll(() => readFile(execution.marker, 'utf8').catch(() => ''))
      .toBe('relay action completed')
    await page.getByText('relay action completed', { exact: true }).first().waitFor()
    await page.screenshot({ path: join(evidenceDir, 'terminal.png') })
    await writeFile(
      join(evidenceDir, 'page.json'),
      JSON.stringify(
        {
          text: await page.locator('body').innerText(),
          inputs: await page.locator('input,textarea').evaluateAll((nodes) =>
            nodes.map((node) => ({
              placeholder: node.placeholder,
              label: node.getAttribute('aria-label'),
              html: node.outerHTML
            }))
          ),
          calls: execution.calls,
          errors
        },
        null,
        2
      )
    )
    expect(execution.calls).toContain('terminal.send')
    expect(pageSockets).toEqual([])
    const previousBuildId = downloaded.manifest.buildId
    const manifest = built.manifest
    const rewritten = await writeMobileWebBundleTree({
      outDir: built.outDir,
      desktopVersion: manifest.desktopVersion,
      protocolWindow: {
        runtimeProtocolVersion: manifest.runtimeProtocolVersion,
        minCompatibleRuntimeProtocolVersion: manifest.minCompatibleRuntimeProtocolVersion
      },
      written: manifest.assets.map((asset) => {
        const original = downloaded.assets.get(asset.path)
        const bytes =
          asset.path === 'index.html'
            ? Buffer.from(
                new TextDecoder()
                  .decode(original)
                  .replace('<title>Orca</title>', '<title>Orca refreshed</title>')
              )
            : original
        return { ...asset, bytes, sha256: sha256Hex(bytes), byteLength: bytes.byteLength }
      })
    })
    const stale = await relay.client.sendRequest('mobileWeb.bundle.chunk', {
      buildId: previousBuildId,
      path: 'index.html',
      offset: 0
    })
    expect(stale).toMatchObject({
      ok: false,
      error: { message: 'mobile_web_bundle_build_changed' }
    })
    downloaded = await fetchMobileWebBundle({ client: relay.client })
    expect(downloaded.manifest.buildId).toBe(rewritten.manifest.buildId)
    expect(downloaded.manifest.buildId).not.toBe(previousBuildId)
    bridge.dispose()
    bridge = attachBridge(downloaded.manifest.buildId, 'reloaded-session')
    await page.reload()
    await page.getByText('Relay workspace', { exact: true }).last().waitFor()
    expect(await page.title()).toBe('Orca refreshed')
    bridge.dispose()
    bridge = attachBridge(
      downloaded.manifest.buildId,
      'notification-session',
      '/h/relay-host/session/folder%3Atest?name=Relay%20workspace'
    )
    await page.reload()
    await page.locator('.xterm-screen').waitFor({ timeout: 30_000 })
    expect(new URL(page.url()).pathname).toBe('/')
    await writeFile(
      join(evidenceDir, 'result.json'),
      JSON.stringify(
        {
          transport: 'local relay with real CloudRelayTransport and NaCl E2EE v2',
          execution: 'deterministic test backend; real Node process wrote action.txt',
          action: await readFile(execution.marker, 'utf8'),
          previousBuildId,
          reloadedBuildId: downloaded.manifest.buildId,
          assetCount: downloaded.assets.size,
          bytes: downloaded.totalBytes,
          wireFrames: relay.wireFrames(),
          pageSockets,
          nativeSessionDestinationOpened: true,
          visibleWindows: await app.evaluate(
            ({ BrowserWindow }) =>
              BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
          ),
          errors
        },
        null,
        2
      )
    )
    expect(errors).toEqual([])
  },
  120_000
)
