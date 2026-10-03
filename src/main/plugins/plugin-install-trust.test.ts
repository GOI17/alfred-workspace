import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { PluginInstallSource } from '../../shared/plugins/plugin-install-lockfile'
import {
  installBundledPlugin,
  installPluginFromLocalPath,
  readPluginLockfile
} from './plugin-install'
import { pluginInstallTrustError } from './plugin-install-trust'

const roots: string[] = []

async function tempRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  roots.push(root)
  return root
}

async function writePlugin(root: string, publisher: string, id: string): Promise<void> {
  await writeFile(
    join(root, 'alfred-plugin.json'),
    JSON.stringify({
      manifestVersion: 1,
      id,
      publisher,
      name: 'Plugin',
      version: '1.0.0',
      engines: { alfred: '>=1.0.0' },
      pluginApi: 1,
      capabilities: []
    })
  )
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('plugin install trust', () => {
  it.each<[PluginInstallSource, string | null]>([
    [
      {
        kind: 'git',
        url: 'https://github.com/attacker/alfred-secrets.git',
        ref: 'main'
      },
      'reserved plugin identity community.alfred-secrets must resolve to the alfredlabs organization'
    ],
    [
      {
        kind: 'git',
        url: 'git@github.com:GOI17/alfred-workspace-secrets.git',
        ref: 'main'
      },
      null
    ]
  ])('enforces reserved source organization', (source, expected) => {
    expect(pluginInstallTrustError('community.alfred-secrets', source)).toBe(expected)
  })

  it('rejects locally installed reserved identities before publication', async () => {
    const sourcePath = await tempRoot('alfred-reserved-plugin-')
    const pluginsDir = await tempRoot('alfred-plugin-installs-')
    await writePlugin(sourcePath, 'alfredlabs', 'alfred-skills')

    await expect(
      installPluginFromLocalPath({ pluginsDir, sourcePath, hostVersion: '1.4.0' })
    ).resolves.toEqual({
      ok: false,
      error:
        'reserved plugin identity alfredlabs.alfred-skills cannot be installed from a local path'
    })
    await expect(readPluginLockfile(pluginsDir)).resolves.toEqual({ version: 1, plugins: {} })
  })

  it('allows the app-bundled path only for the complete official identity', async () => {
    const sourcePath = await tempRoot('alfred-bundled-plugin-')
    const pluginsDir = await tempRoot('alfred-plugin-installs-')
    await writePlugin(sourcePath, 'alfredlabs', 'alfred-skills')

    const result = await installBundledPlugin({
      pluginsDir,
      sourcePath,
      hostVersion: '1.4.0',
      expectedPluginKey: 'alfredlabs.alfred-skills'
    })

    expect(result).toMatchObject({ ok: true, pluginKey: 'alfredlabs.alfred-skills' })
    const lock = await readPluginLockfile(pluginsDir)
    expect(lock.plugins['alfredlabs.alfred-skills']?.source).toEqual({
      kind: 'bundled',
      bundleId: 'alfredlabs.alfred-skills'
    })
  })

  it('blocks a killed plugin even when the caller bypasses marketplace UI', async () => {
    const sourcePath = await tempRoot('alfred-killed-plugin-')
    const pluginsDir = await tempRoot('alfred-plugin-installs-')
    await writePlugin(sourcePath, 'community', 'unsafe')

    await expect(
      installPluginFromLocalPath({
        pluginsDir,
        sourcePath,
        hostVersion: '1.4.0',
        blockedPluginReason: (pluginKey) =>
          pluginKey === 'community.unsafe' ? 'Security incident' : null
      })
    ).resolves.toEqual({
      ok: false,
      error: "plugin is blocked by Alfred's safety list: Security incident"
    })
  })
})
