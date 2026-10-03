import { expect, it } from 'vitest'
import { createBrowserApi, createEmulatorApi } from './web-browser-api'

it('returns actionable refusal results for browser operations unavailable on web', async () => {
  const browser = createBrowserApi()
  await expect(browser.setGrabMode({ browserPageId: 'page', enabled: true })).resolves.toEqual({
    ok: false,
    reason: 'not-ready'
  })
  await expect(
    browser.awaitGrabSelection({ browserPageId: 'page', opId: 'selection' })
  ).resolves.toEqual({
    opId: 'selection',
    kind: 'error',
    reason: expect.any(String)
  })
  await expect(browser.extractHoverPayload({ browserPageId: 'page' })).resolves.toEqual({
    ok: false,
    reason: expect.any(String)
  })
  await expect(browser.sessionImportCookies({ profileId: 'profile' })).resolves.toEqual({
    ok: false,
    reason: expect.any(String)
  })
})

it('rejects unavailable emulator video instead of leaving the API method undefined', async () => {
  const emulator = createEmulatorApi()
  await expect(
    emulator.startVideoStream({ deviceId: 'device', streamId: 'stream' })
  ).rejects.toThrow('unavailable on web')
  await expect(emulator.stopVideoStream({ streamId: 'stream' })).resolves.toBeUndefined()
})
