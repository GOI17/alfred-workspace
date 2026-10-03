import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { _electron as electron, type ElectronApplication } from '@stablyai/playwright-test'
import { test, expect } from './helpers/alfred-app'
import {
  assertElectronResolvedIsolatedHome,
  createElectronHomeIsolation
} from './helpers/electron-home-isolation'
import { cleanupE2EDaemons, closeElectronAppForE2E } from './helpers/electron-process-shutdown'
import { getElectronKeychainIsolationArgs } from './helpers/electron-launch-args'

const packagedApp = process.env.ALFRED_MACOS_PACKAGED_APP

test('starts a relocated macOS package with an isolated profile and hidden windows', async () => {
  const testInfo = test.info()
  test.skip(
    process.platform !== 'darwin' || !packagedApp,
    'Set ALFRED_MACOS_PACKAGED_APP to a macOS app bundle'
  )
  if (!packagedApp) {
    throw new Error('Missing packaged app path')
  }
  test.setTimeout(120_000)
  const root = mkdtempSync(path.join(tmpdir(), 'alfred-packaged-startup-'))
  const userDataDir = path.join(root, 'profile')
  const appPath = path.join(root, 'Installed Apps', 'Alfred workspace.app')
  let app: ElectronApplication | undefined
  try {
    cpSync(path.resolve(packagedApp), appPath, { recursive: true, verbatimSymlinks: true })
    const { ELECTRON_RUN_AS_NODE: _runAsNode, ...inheritedEnv } = process.env
    void _runAsNode
    const isolation = createElectronHomeIsolation({
      inheritedEnv,
      launchEnv: {
        ORCA_BACKGROUND_LAUNCH: '1',
        ALFRED_BACKGROUND_LAUNCH: '1',
        ALFRED_E2E_HEADLESS: '1'
      },
      extraEnv: {},
      userDataDir
    })
    app = await electron.launch({
      executablePath: path.join(appPath, 'Contents', 'MacOS', 'Alfred workspace'),
      args: [...getElectronKeychainIsolationArgs(), '-ApplePersistenceIgnoreState', 'YES'],
      env: Object.fromEntries(
        Object.entries(isolation.env).filter(
          (entry): entry is [string, string] => entry[1] !== undefined
        )
      )
    })
    const page = await app.firstWindow()
    const identity = await app.evaluate(({ app: launchedApp, BrowserWindow }) => ({
      name: launchedApp.getName(),
      packaged: launchedApp.isPackaged,
      home: launchedApp.getPath('home'),
      visibleWindows: BrowserWindow.getAllWindows().filter((window) => window.isVisible()).length
    }))
    assertElectronResolvedIsolatedHome(identity.home, isolation)
    expect(identity.name).toBe('Alfred workspace')
    expect(identity.packaged).toBe(true)
    expect(identity.visibleWindows).toBe(0)
    await expect(
      page.getByRole('heading', { name: 'Pick your default agent', exact: true })
    ).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Alfred onboarding', exact: true })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('macos-packaged-startup.png') })
  } finally {
    try {
      if (app) {
        await closeElectronAppForE2E(app)
      }
    } finally {
      await cleanupE2EDaemons(userDataDir)
      rmSync(root, { recursive: true, force: true })
    }
  }
})
