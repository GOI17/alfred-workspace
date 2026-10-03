import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPackage, extractFile } from '@electron/asar'
import { expect, it } from 'vitest'
import { buildMobileWebAppBundle } from './build-mobile-web-app-bundle.mjs'
import { mobileWebAppDependenciesPresent } from './mobile-web-app-bundle-dependencies.mjs'
import { sha256Hex } from './build-mobile-web-bundle.mjs'
import { buildMobileBrowser } from './build-mobile-browser.mjs'

it.skipIf(!mobileWebAppDependenciesPresent())(
  'preserves every real screen asset in the desktop archive',
  async () => {
    const scratch = await mkdtemp(join(tmpdir(), 'orca-mobile-ui-asar-'))
    try {
      const source = join(scratch, 'app')
      const bundle = await buildMobileWebAppBundle({ outDir: join(source, 'out', 'mobile-web') })
      const browser = await buildMobileBrowser(join(source, 'out/web'), false)
      const archive = join(scratch, 'app.asar')
      await createPackage(source, archive)
      expect(extractFile(archive, 'out/web/mobile-browser.html').toString()).toBe(browser.html)
      for (const match of browser.html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)) {
        expect(extractFile(archive, `out/web/${match[1]}`).byteLength).toBeGreaterThan(0)
      }
      expect(extractFile(archive, 'out/mobile-web/manifest.json')).toEqual(
        await readFile(join(bundle.outDir, 'manifest.json'))
      )
      for (const asset of bundle.manifest.assets) {
        const bytes = extractFile(archive, `out/mobile-web/${asset.path}`)
        expect(bytes.byteLength, asset.path).toBe(asset.byteLength)
        expect(sha256Hex(bytes), asset.path).toBe(asset.sha256)
      }
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  },
  60_000
)
