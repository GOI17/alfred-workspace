import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getAlfredElectronLaunchArgs } from './electron-launch-args'

describe('getAlfredElectronLaunchArgs', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([
    ['linux', 'true', true, true],
    ['linux', undefined, true, false],
    ['linux', 'true', false, false],
    ['darwin', 'true', true, false],
    ['win32', 'true', true, false]
  ] as const)(
    'scopes software WebGL to Linux CI headful launches: %s/%s/%s',
    (platform, ci, headful, enabled) => {
      vi.stubGlobal('process', { ...process, platform, env: { ...process.env, CI: ci } })
      const args = getAlfredElectronLaunchArgs(join('alfred', 'out', 'main', 'index.js'), headful)
      expect(args.includes('--use-gl=angle')).toBe(enabled)
      expect(args.includes('--use-angle=swiftshader')).toBe(enabled)
      expect(args.includes('--enable-unsafe-swiftshader')).toBe(enabled)
      if (enabled) {
        expect(args).toContain('--disable-gpu-sandbox')
        expect(args).not.toContain('--disable-gpu')
      }
    }
  )

  it('launches the package root that owns the compiled main entry', () => {
    const root = join('workspace', 'alfred')
    const mainPath = join(root, 'out', 'main', 'index.js')

    const args = getAlfredElectronLaunchArgs(mainPath, true)
    if (process.platform === 'darwin') {
      expect(args).toEqual([
        '--password-store=basic',
        '--use-mock-keychain',
        root,
        '-ApplePersistenceIgnoreState',
        'YES'
      ])
    } else {
      expect(args.at(-1)).toBe(root)
    }
    expect(getAlfredElectronLaunchArgs(mainPath, false)).toContain(root)
  })
})
