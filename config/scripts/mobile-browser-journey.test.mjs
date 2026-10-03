import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { afterAll, expect, it } from 'vitest'
import { _electron as electron } from 'playwright-core'
import { buildMobileWebAppBundle } from './build-mobile-web-app-bundle.mjs'
import { buildMobileBrowser } from './build-mobile-browser.mjs'
import { mobileWebAppDependenciesPresent } from './mobile-web-app-bundle-dependencies.mjs'
import { browserRelayFixture } from './mobile-browser-relay-fixture.mjs'
import { mobileWebJourneyTestRuntime } from './mobile-web-journey-test-runtime.mjs'
import {
  installMobileWebBundleAppPath,
  mobileWebBundleDispatcher
} from '../../src/main/runtime/rpc/methods/mobile-web-bundle.test-fixture'
import { createStaticWebClientHandler } from '../../src/main/runtime/rpc/static-web-client-handler'
import { createMobileBrowserLink } from '../../src/shared/mobile-browser-link'
import { sha256Hex, writeMobileWebBundleTree } from './build-mobile-web-bundle.mjs'

const require = createRequire(import.meta.url)
let scratch, relay, app, server
afterAll(async () => {
  await app?.close()
  server?.close()
  await relay?.close()
  if (scratch) {
    await rm(scratch, { recursive: true, force: true })
  }
})

it.skipIf(!mobileWebAppDependenciesPresent())(
  'opens a QR link in a browser, pairs over encrypted relay, downloads the real UI and runs a terminal action',
  async () => {
    scratch = await mkdtemp(join(tmpdir(), 'alfred-browser-'))
    const evidence = join(process.cwd(), 'out/mobile-browser-validation')
    await mkdir(evidence, { recursive: true })
    const built = await buildMobileWebAppBundle({ outDir: join(scratch, 'out/mobile-web') })
    await buildMobileBrowser(join(scratch, 'entry'), false)
    installMobileWebBundleAppPath(scratch)
    const dispatcher = mobileWebBundleDispatcher()
    relay = await browserRelayFixture(scratch, async (request, reply) => {
      if (request.method.startsWith('mobileWeb.bundle.')) {
        reply(
          await dispatcher.dispatch(
            { ...request, authToken: 'test-token' },
            { connectionId: 'browser-test' }
          )
        )
      } else {
        await execution.dispatch(request, reply)
      }
    })
    const execution = mobileWebJourneyTestRuntime(scratch, relay.deviceToken)
    const requests = []
    const handler = createStaticWebClientHandler(join(scratch, 'entry'))
    server = createServer((request, response) => {
      requests.push(request.url)
      handler(request, response)
    })
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const main = join(scratch, 'hidden.cjs')
    await writeFile(
      main,
      `const {app,BrowserWindow}=require('electron');app.on('window-all-closed',()=>app.quit());app.whenReady().then(()=>{global.window=new BrowserWindow({show:false,width:390,height:844,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});global.window.loadURL('about:blank')});`
    )
    app = await electron.launch({
      executablePath: require('electron'),
      args: [main],
      env: { ...process.env, ORCA_BACKGROUND_LAUNCH: '1' }
    })
    const page = await app.firstWindow()
    const errors = []
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text().slice(0, 220))
      }
    })
    page.on('pageerror', (error) => errors.push(error.message.slice(0, 200)))
    // Only cloud TLS termination is substituted. The browser owns the actual WebSocket and E2EE client.
    await page.addInitScript((port) => {
      // Electron's native confirmation can reveal its parent window; keep approval in the hidden renderer.
      globalThis.confirm = () => true
      const NativeWebSocket = globalThis.WebSocket
      globalThis.WebSocket = class extends NativeWebSocket {
        constructor(url, protocols) {
          super(
            String(url).replace(`wss://127.0.0.1:${port}/`, `ws://127.0.0.1:${port}/`),
            protocols
          )
        }
      }
    }, relay.port)
    const entryUrl = `http://127.0.0.1:${server.address().port}/mobile-browser.html`
    // Pasting a pairing link into the already-open entry is a hash navigation, not a page load.
    await page.goto(entryUrl)
    await page.getByLabel('Desktop pairing code').waitFor()
    await page.goto(createMobileBrowserLink(entryUrl, relay.pairingUrl))
    await expect.poll(() => new URL(page.url()).hash).toBe('')
    const frame = page.frameLocator('iframe')
    try {
      await Promise.race([
        frame.getByText('Relay workspace', { exact: true }).first().waitFor({ timeout: 45_000 }),
        page
          .getByRole('alert')
          .waitFor({ timeout: 45_000 })
          .then(async () => {
            throw new Error(await page.getByRole('alert').innerText())
          })
      ])
    } catch (error) {
      await writeFile(
        join(evidence, 'failure.json'),
        JSON.stringify(
          {
            text: await page.locator('body').innerText(),
            errors,
            consoleErrors,
            frames: relay.frames(),
            calls: execution.calls
          },
          null,
          2
        )
      )
      throw error
    }
    await page.screenshot({ path: join(evidence, 'workspace.png') })
    expect(await page.locator('iframe').getAttribute('sandbox')).toBe('allow-scripts')
    const isolation = await frame.locator('body').evaluate(() => {
      let parentBlocked = false,
        storageBlocked = false
      try {
        void parent.document.body
      } catch {
        parentBlocked = true
      }
      try {
        void sessionStorage.length
      } catch {
        storageBlocked = true
      }
      return { parentBlocked, storageBlocked, bridge: typeof globalThis.orcaBridge?.postMessage }
    })
    expect(isolation).toEqual({ parentBlocked: true, storageBlocked: true, bridge: 'function' })
    await frame.getByRole('button', { name: 'New workspace', exact: true }).click()
    try {
      await frame.getByRole('button', { name: 'Add project', exact: true }).click({ timeout: 5000 })
      await frame
        .getByRole('button', { name: 'Open folder web-added-project', exact: true })
        .click({ timeout: 5000 })
    } catch (error) {
      await page.screenshot({ path: join(evidence, 'project-drawer-failure.png') })
      await writeFile(
        join(evidence, 'project-drawer-failure.json'),
        JSON.stringify(
          {
            errors,
            consoleErrors,
            text: await frame.locator('body').innerText(),
            calls: execution.calls
          },
          null,
          2
        )
      )
      throw error
    }
    await frame.getByRole('radio', { name: 'Folder project', exact: true }).click()
    await frame.getByRole('button', { name: 'Add this folder', exact: true }).click()
    await frame.getByText('web-added-project', { exact: true }).waitFor()
    expect(execution.addedProjects).toEqual([
      {
        id: 'web-added',
        displayName: 'web-added-project',
        path: join(scratch, 'web-added-project'),
        kind: 'folder'
      }
    ])
    await page.screenshot({ path: join(evidence, 'project-added.png') })
    await page.reload()
    await frame.getByText('Relay workspace', { exact: true }).first().waitFor()
    await frame.getByText('Relay workspace', { exact: true }).last().click()
    try {
      await frame.locator('.xterm-screen').waitFor()
    } catch (error) {
      await writeFile(
        join(evidence, 'terminal-failure.json'),
        JSON.stringify(
          {
            text: await frame
              .locator('body')
              .innerText()
              .catch(() => 'renderer unavailable'),
            errors,
            consoleErrors,
            calls: execution.calls
          },
          null,
          2
        )
      )
      throw error
    }
    await frame.getByText('Live input', { exact: true }).click()
    await page.keyboard.insertText('orca-ui-proof')
    await frame.getByText('Enter', { exact: true }).click()
    await expect
      .poll(() => readFile(execution.marker, 'utf8').catch(() => ''))
      .toBe('relay action completed')
    await page.screenshot({ path: join(evidence, 'terminal.png') })
    const connections = relay.connections()
    relay.interrupt()
    await expect.poll(() => relay.connections(), { timeout: 30_000 }).toBeGreaterThan(connections)
    await expect
      .poll(() => page.getByRole('status').first().innerText(), { timeout: 30_000 })
      .toBe('Connected')
    const written = await Promise.all(
      built.manifest.assets.map(async (asset) => {
        const original = await readFile(join(built.outDir, asset.path))
        const bytes =
          asset.path === 'index.html'
            ? Buffer.from(
                original
                  .toString()
                  .replace('<title>Orca</title>', '<title>Alfred refreshed</title>')
              )
            : original
        return { ...asset, bytes, byteLength: bytes.byteLength, sha256: sha256Hex(bytes) }
      })
    )
    const rebuilt = await writeMobileWebBundleTree({
      outDir: built.outDir,
      desktopVersion: built.manifest.desktopVersion,
      protocolWindow: {
        runtimeProtocolVersion: built.manifest.runtimeProtocolVersion,
        minCompatibleRuntimeProtocolVersion: built.manifest.minCompatibleRuntimeProtocolVersion
      },
      written
    })
    expect(rebuilt.manifest.buildId).not.toBe(built.manifest.buildId)
    expect(await frame.locator('title').textContent()).toBe('Orca')
    await page.getByRole('button', { name: 'Reload UI' }).click()
    await frame.getByText('Relay workspace', { exact: true }).last().waitFor()
    await expect.poll(() => frame.locator('title').textContent()).toBe('Alfred refreshed')
    await page.reload()
    await frame.getByText('Relay workspace', { exact: true }).last().waitFor({ timeout: 30_000 })
    await page.goto('about:blank')
    await page.goto(createMobileBrowserLink(entryUrl, relay.pairingUrl))
    await frame.getByText('Relay workspace', { exact: true }).last().waitFor({ timeout: 30_000 })
    expect(await page.getByLabel('Desktop pairing code').count()).toBe(0)
    expect(requests.every((url) => !url.includes('pairing') && !url.includes('orca:'))).toBe(true)
    expect(await page.locator('iframe').getAttribute('srcdoc')).not.toContain(relay.deviceToken)
    const visible = await app.evaluate(
      ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
    )
    expect(visible).toBe(0)
    expect(errors).toEqual([])
    await writeFile(
      join(evidence, 'result.json'),
      JSON.stringify(
        {
          action: await readFile(execution.marker, 'utf8'),
          relayFrames: relay.frames(),
          isolation,
          visibleWindows: visible,
          errors,
          browserReloadRestored: true,
          automaticPairing: ['same-document link', 'fresh page'],
          projectAddedOverRelay: execution.addedProjects.length === 1,
          beforeBuildId: built.manifest.buildId,
          afterBuildId: rebuilt.manifest.buildId,
          recoveredRelayConnections: relay.connections(),
          fixture:
            'local relay admission and credential journal; real RPC/E2EE and Node action; TLS mapped to loopback WS'
        },
        null,
        2
      )
    )
  },
  120_000
)
