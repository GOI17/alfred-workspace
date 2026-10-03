import { describe, expect, it } from 'vitest'
import {
  createMobileBrowserLink,
  localMobileBrowserEntryUrl,
  mobileBrowserEntryUrl,
  mobileBrowserPairingOptions
} from './mobile-browser-link'

describe('browser pairing links', () => {
  it.each(['ws://0.0.0.0:47231', 'ws://127.0.0.1:47231', 'ws://[::]:47231'])(
    'discovers local browser access from the actual endpoint %s',
    (endpoint) => {
      expect(localMobileBrowserEntryUrl(endpoint)).toBe(
        'http://localhost:47231/mobile-browser.html'
      )
    }
  )
  it('keeps TLS and rejects a non-WebSocket discovery result', () => {
    expect(localMobileBrowserEntryUrl('wss://127.0.0.1:9443')).toBe(
      'https://localhost:9443/mobile-browser.html'
    )
    expect(() => localMobileBrowserEntryUrl('https://example.com')).toThrow()
  })
  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'uses direct pairing for an explicit %s preview',
    (host) => {
      expect(mobileBrowserPairingOptions(`http://${host}:6769/mobile-browser.html`)).toMatchObject({
        connectionMode: 'local-only',
        address: '127.0.0.1'
      })
    }
  )
  it('keeps remote browser access on Relay', () => {
    expect(mobileBrowserPairingOptions('https://alfred.example/mobile-browser.html')).toEqual({
      browserEntryUrl: 'https://alfred.example/mobile-browser.html',
      connectionMode: 'automatic'
    })
    expect(() => mobileBrowserPairingOptions('http://localhost.evil.example/')).toThrow()
  })
  it('keeps the bearer out of HTTP paths, queries and referrers', () => {
    const link = new URL(
      createMobileBrowserLink(
        'https://alfred.example/mobile-browser.html',
        'orca://pair#secret-token'
      )
    )
    expect(link.pathname).toBe('/mobile-browser.html')
    expect(link.search).toBe('')
    expect(new URLSearchParams(link.hash.slice(1)).get('pairing')).toBe('orca://pair#secret-token')
  })
  it.each([
    'http://example.com/',
    'javascript:alert(1)',
    'file:///entry.html',
    'https://u:p@example.com/',
    'https://example.com/?secret=x',
    'https://example.com/#x'
  ])('refuses an unsafe entry address %s', (url) => {
    expect(() => mobileBrowserEntryUrl(url)).toThrow()
  })
  it('allows HTTP only for local development', () => {
    expect(mobileBrowserEntryUrl('http://127.0.0.1:6768/mobile-browser.html').hostname).toBe(
      '127.0.0.1'
    )
    expect(() => mobileBrowserEntryUrl('http://192.168.1.2:6768/mobile-browser.html')).toThrow()
  })
})
