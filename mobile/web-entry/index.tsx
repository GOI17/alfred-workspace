import './page.css'
import './frame-local-storage'
// Route A web entry: mounts the phone's h/[hostId] route tree on react-native-web.
// Built into out/mobile-web and delivered over the paired native RPC connection.
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { ExpoRoot } from 'expo-router'
import { RpcClientProvider } from '../src/transport/client-context'
import { getShellHostPath } from '../src/transport/host-store.web'
// Body replaced at build time: esbuild has no require.context, so the builder synthesizes one.
import routeContext from './route-manifest'

// Progress of the mount, in one attribute, so the render check can tell a page that never ran
// its script from one that ran it and threw. Effects run child-first, so 'mounted' lands only
// after the router tree below this wrapper has committed.
const MOUNT_STATE_ATTRIBUTE = 'orcaWebEntry'

// ExpoRoot captures its initial URL at import time; mount it only after bridge init selected the host.
function RoutedApp() {
  useEffect(() => {
    document.documentElement.dataset[MOUNT_STATE_ATTRIBUTE] = 'mounted'
  }, [])
  return (
    <ExpoRoot
      context={routeContext}
      location={getShellHostPath() ?? new URL(window.location.href)}
    />
  )
}

const container = document.getElementById('root')
if (!container) {
  throw new Error('[orca-mobile-web-app] #root missing')
}
document.documentElement.dataset[MOUNT_STATE_ATTRIBUTE] = 'started'
createRoot(container).render(
  <RpcClientProvider>
    <RoutedApp />
  </RpcClientProvider>
)
