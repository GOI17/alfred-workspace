import { useRouter, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  loadMobileOnboardingSteps,
  mobileOnboardingDestination
} from '../onboarding/mobile-onboarding-plan'
import {
  selectConnectableHostProfiles,
  sortHostsByLastConnected
} from '../transport/host-catalog-selection'
import { loadHostCatalog } from '../transport/host-store'
import type { HostCatalogEntry } from '../transport/types'
import { projectHomeHostConnections } from './home-host-connection-projection'
import { useMobileHomeHostConnections } from './use-mobile-home-host-connections'

export function useMobileHomeData() {
  const router = useRouter()
  const [hostCatalog, setHostCatalog] = useState<HostCatalogEntry[]>([])
  const onboardingCheckedRef = useRef(false)
  const hosts = useMemo(() => selectConnectableHostProfiles(hostCatalog), [hostCatalog])
  const connections = useMobileHomeHostConnections(hosts, hostCatalog)
  useFocusEffect(
    useCallback(() => {
      let stale = false
      void loadHostCatalog().then(async (catalog) => {
        if (stale) {
          return
        }
        setHostCatalog(catalog)
        if (catalog.length === 0 || onboardingCheckedRef.current) {
          return
        }
        onboardingCheckedRef.current = true
        const steps = await loadMobileOnboardingSteps()
        if (!stale && steps.length > 0) {
          router.replace(mobileOnboardingDestination(steps))
        }
      })
      return () => {
        stale = true
      }
    }, [router])
  )
  const sortedHostCatalog = useMemo(() => sortHostsByLastConnected(hostCatalog), [hostCatalog])
  const projection = useMemo(
    () => projectHomeHostConnections(connections.allClients),
    [connections.allClients]
  )
  return {
    ...connections,
    hostCatalog,
    hostPairingRejected: projection.hostPairingRejected,
    hostSignedOut: projection.hostSignedOut,
    hostPaths: projection.hostPaths,
    hostPendingPaths: projection.hostPendingPaths,
    router,
    setHostCatalog,
    sortedHostCatalog
  }
}
