import { createBridgeHost } from '../src/mobile-web-shell/bridge-host'
import type { MobileWebBundleFetchResult } from '../src/transport/mobile-web-bundle-fetch'
import type { RpcClient } from '../src/transport/rpc-client'
import type { HostProfile } from '../src/transport/types'

const VIRTUAL_ORIGIN = 'https://orca-bundle.invalid'
const FRAME_CSP =
  "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

function dataUrl(bytes: Uint8Array, contentType: string): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return `data:${contentType};base64,${btoa(binary)}`
}

export function browserBundleDocument(bundle: MobileWebBundleFetchResult, channel: string): string {
  const modules: Record<string, string> = {}
  const resources = new Map<string, string>()
  for (const asset of bundle.manifest.assets) {
    const bytes = bundle.assets.get(asset.path)
    if (!bytes) {
      throw new Error('Incomplete host interface')
    }
    if (
      !asset.path.endsWith('.js') &&
      !asset.path.endsWith('.html') &&
      !asset.path.endsWith('.css')
    ) {
      resources.set(`/${asset.path}`, dataUrl(bytes, asset.contentType))
    }
  }
  function rewrite(text: string): string {
    for (const [path, url] of resources) {
      if (!path.endsWith('.js') && !path.endsWith('.css')) {
        text = text.split(path).join(url)
      }
    }
    return text.replaceAll('/assets/', `${VIRTUAL_ORIGIN}/assets/`)
  }
  for (const asset of bundle.manifest.assets) {
    if (!asset.path.endsWith('.js') && !asset.path.endsWith('.css')) {
      continue
    }
    const bytes = bundle.assets.get(asset.path)
    if (!bytes) {
      throw new Error('Incomplete host interface')
    }
    const source = rewrite(new TextDecoder().decode(bytes))
    if (asset.path.endsWith('.js')) {
      modules[`${VIRTUAL_ORIGIN}/${asset.path}`] = source
    } else {
      resources.set(`/${asset.path}`, dataUrl(new TextEncoder().encode(source), asset.contentType))
    }
  }
  const entry = bundle.assets.get(bundle.manifest.entrypoint)
  if (!entry) {
    throw new Error('Missing host interface entrypoint')
  }
  let html = new TextDecoder().decode(entry)
  for (const [path, url] of resources) {
    html = html.split(path).join(url)
  }
  html = html.replace(
    /<script type="module" src="(\/assets\/[a-f0-9]+\.js)"><\/script>/g,
    (_match, path: string) => {
      if (!modules[`${VIRTUAL_ORIGIN}${path}`]) {
        throw new Error('Missing host entry module')
      }
      return `<script type="module">import ${JSON.stringify(`${VIRTUAL_ORIGIN}${path}`)};</script>`
    }
  )
  const bridge = `const channel=${JSON.stringify(channel)};globalThis.orcaBridge={onmessage:null,postMessage(json){parent.postMessage({channel,json},'*')}};addEventListener('message',event=>{if(event.source===parent&&event.data?.channel===channel&&typeof event.data.json==='string')globalThis.orcaBridge.onmessage?.({data:event.data.json})});`
  // Create module URLs inside the opaque frame so scripts cannot inherit the loader's origin.
  const moduleMap = `const modules=${JSON.stringify(modules).replaceAll('<', '\\u003c')};const imports={};for(const [name,source] of Object.entries(modules)){imports[name]=URL.createObjectURL(new Blob([source],{type:'text/javascript'}))}const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.appendChild(map);addEventListener('pagehide',()=>Object.values(imports).forEach(url=>URL.revokeObjectURL(url)),{once:true});`
  return html.replace(
    '<head>',
    () =>
      `<head><meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}"><meta name="referrer" content="no-referrer"><script>${bridge}${moduleMap}</script>`
  )
}

export function mountBrowserBundle(args: {
  frame: HTMLIFrameElement
  bundle: MobileWebBundleFetchResult
  client: RpcClient
  host: HostProfile
}): () => void {
  const channel = crypto.randomUUID()
  const bridge = createBridgeHost({
    client: args.client,
    clientId: args.host.deviceToken,
    host: { id: args.host.id, name: args.host.name },
    sessionId: channel,
    buildId: args.bundle.manifest.buildId,
    post: async (json) => args.frame.contentWindow?.postMessage({ channel, json }, '*')
  })
  const receive = (event: MessageEvent) => {
    if (
      event.source === args.frame.contentWindow &&
      event.origin === 'null' &&
      event.data?.channel === channel &&
      typeof event.data.json === 'string'
    ) {
      bridge.receive(event.data.json)
    }
  }
  window.addEventListener('message', receive)
  args.frame.setAttribute('sandbox', 'allow-scripts')
  args.frame.referrerPolicy = 'no-referrer'
  args.frame.srcdoc = browserBundleDocument(args.bundle, channel)
  return () => {
    window.removeEventListener('message', receive)
    bridge.dispose()
    args.frame.removeAttribute('srcdoc')
  }
}
