import { fetchMobileWebBundle } from '../src/transport/mobile-web-bundle-fetch'
import { evaluateMobileWebBundleCompat } from '../src/transport/mobile-web-bundle-compat'
import { hostStatusProbe, readHostStatusGates } from '../src/transport/host-status-probe-operations'
import { evaluateCompat } from '../src/transport/protocol-compat'
import type { RpcClient } from '../src/transport/rpc-client'

export async function readBrowserHostInterface(
  client: RpcClient,
  signal: AbortSignal,
  onProgress: (label: string) => void
) {
  const status = readHostStatusGates(await hostStatusProbe.request(client))
  if (!status) {
    throw new Error('Desktop did not return its version. Reconnect and try again.')
  }
  const compatibility = evaluateCompat({
    desktopProtocolVersion: status.protocolVersion,
    desktopMinCompatibleMobileVersion: status.minCompatibleMobileVersion
  })
  if (compatibility.kind !== 'ok') {
    throw new Error('Update desktop and reload this page to use compatible versions.')
  }
  const input = { hostCapabilities: status.capabilities ?? [], hostStatus: status }
  if (evaluateMobileWebBundleCompat({ ...input, manifest: null }).kind !== 'ok') {
    throw new Error('Update desktop: this host does not provide a mobile web interface.')
  }
  const bundle = await fetchMobileWebBundle({
    client,
    signal,
    onProgress: ({ completedAssets, totalAssets }) =>
      onProgress(`Loading interface ${completedAssets}/${totalAssets}`)
  })
  if (evaluateMobileWebBundleCompat({ ...input, manifest: bundle.manifest }).kind !== 'ok') {
    throw new Error('The host interface is incompatible. Rebuild it on desktop and retry.')
  }
  return bundle
}
