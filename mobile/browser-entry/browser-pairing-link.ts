export function consumeBrowserPairingLink(): string | null {
  const params = new URLSearchParams(location.hash.slice(1))
  if (!params.has('pairing')) {
    return null
  }
  const code = params.get('pairing') ?? ''
  // Consume credentials on both initial load and same-document navigation.
  history.replaceState(null, '', location.pathname + location.search)
  return code
}
