import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  extractManifestAssetNames,
  getRequiredReleaseAssetNames,
  verifyRequiredReleaseAssets
} from './verify-release-required-assets.mjs'

function jsonResponse(body) {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: vi.fn(async () => body),
    text: vi.fn(async () => (typeof body === 'string' ? body : JSON.stringify(body)))
  }
}

function releaseWithAssets(tag, assetNames) {
  return {
    tag_name: tag,
    draft: true,
    prerelease: false,
    assets: assetNames.map((name, index) => ({
      id: index + 1,
      name,
      state: 'uploaded',
      size: 123
    }))
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('getRequiredReleaseAssetNames', () => {
  it('requires the complete Apple Silicon release without unsupported platform artifacts', () => {
    expect(getRequiredReleaseAssetNames('v1.4.27')).toEqual([
      'latest-mac.yml',
      'Alfred-1.4.27-arm64-mac.zip',
      'Alfred-1.4.27-arm64-mac.zip.blockmap',
      'alfred-macos-arm64.dmg',
      'alfred-macos-arm64.dmg.blockmap'
    ])
  })
})

describe('extractManifestAssetNames', () => {
  it('extracts relative and absolute manifest asset names', () => {
    expect(
      extractManifestAssetNames(
        [
          'files:',
          '  - url: Alfred-1.4.27-arm64-mac.zip',
          '  - url: https://example.com/downloads/alfred-windows-setup.exe',
          'path: alfred-linux.AppImage'
        ].join('\n')
      )
    ).toEqual(['Alfred-1.4.27-arm64-mac.zip', 'alfred-windows-setup.exe', 'alfred-linux.AppImage'])
  })
})

describe('verifyRequiredReleaseAssets', () => {
  it('fails when a manifest-referenced asset has not been uploaded', async () => {
    const tag = 'v1.4.27'
    const required = getRequiredReleaseAssetNames(tag)
    const assets = required.filter((name) => name !== 'Alfred-1.4.27-arm64-mac.zip')
    const release = releaseWithAssets(tag, assets)
    const latestMacAsset = release.assets.find((asset) => asset.name === 'latest-mac.yml')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([release]))
      .mockResolvedValueOnce(
        jsonResponse(
          [
            'version: 1.4.27',
            'files:',
            '  - url: Alfred-1.4.27-arm64-mac.zip',
            '    sha512: test',
            'path: Alfred-1.4.27-arm64-mac.zip'
          ].join('\n')
        )
      )
      .mockResolvedValue(jsonResponse('version: 1.4.27\n'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyRequiredReleaseAssets({ repo: 'GOI17/alfred-workspace', tag, token: 'token' })
    ).rejects.toThrow('Missing: Alfred-1.4.27-arm64-mac.zip')
    expect(latestMacAsset).toBeTruthy()
  })

  it('checks additional assets referenced by the macOS updater manifest', async () => {
    const tag = 'v1.4.27'
    const required = getRequiredReleaseAssetNames(tag)
    const release = releaseWithAssets(tag, required)
    const arm64Manifest = release.assets.find((asset) => asset.name === 'latest-mac.yml')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([release]))
      .mockResolvedValueOnce(
        jsonResponse(
          [
            'version: 1.4.27',
            'files:',
            '  - url: additional-mac-asset.zip',
            'path: Alfred-1.4.27-arm64-mac.zip'
          ].join('\n')
        )
      )
      .mockResolvedValue(jsonResponse('version: 1.4.27\n'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyRequiredReleaseAssets({ repo: 'GOI17/alfred-workspace', tag, token: 'token' })
    ).rejects.toThrow('Missing: additional-mac-asset.zip')
    expect(arm64Manifest).toBeTruthy()
  })

  it('accepts a complete Apple Silicon release without other platform assets', async () => {
    const tag = 'v1.4.27'
    const required = getRequiredReleaseAssetNames(tag)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse([releaseWithAssets(tag, required)]))
        .mockResolvedValueOnce(jsonResponse('files:\n  - url: Alfred-1.4.27-arm64-mac.zip\n'))
    )

    await expect(
      verifyRequiredReleaseAssets({ repo: 'GOI17/alfred-workspace', tag, token: 'token' })
    ).resolves.toMatchObject({ tag, checked: [...required].sort(), draft: true })
  })
})
