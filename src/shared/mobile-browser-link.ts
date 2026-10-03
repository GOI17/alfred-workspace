const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

export function localMobileBrowserEntryUrl(endpoint: string): string {
  const url = new URL(endpoint)
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Desktop did not return a WebSocket endpoint.')
  }
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
  url.hostname = 'localhost'
  url.pathname = '/mobile-browser.html'
  url.search = ''
  url.hash = ''
  return mobileBrowserEntryUrl(url.toString()).toString()
}

export function mobileBrowserEntryUrl(value: string): URL {
  const url = new URL(value)
  const loopback = LOOPBACK_HOSTS.includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('Use an HTTPS web address without credentials, a query or a fragment.')
  }
  return url
}

export function createMobileBrowserLink(entryUrl: string, pairingUrl: string): string {
  const url = mobileBrowserEntryUrl(entryUrl)
  // Fragments are consumed locally and never enter HTTP requests or referrer headers.
  url.hash = new URLSearchParams({ pairing: pairingUrl }).toString()
  return url.toString()
}

export function mobileBrowserPairingOptions(entryUrl: string) {
  const url = mobileBrowserEntryUrl(entryUrl)
  if (LOOPBACK_HOSTS.includes(url.hostname)) {
    return {
      browserEntryUrl: url.toString(),
      connectionMode: 'local-only' as const,
      address: '127.0.0.1'
    }
  }
  return { browserEntryUrl: url.toString(), connectionMode: 'automatic' as const }
}
