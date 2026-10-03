import { useAppStore } from '@/store'
import { ALFRED_BROWSER_PARTITION } from '../../../../../shared/constants'
import { getAlfredProfileBrowserDefaultPartition } from '../../../../../shared/alfred-profiles'

export function useBrowserPageWebviewPartition({
  sessionProfileId,
  sessionPartition
}: {
  sessionProfileId: string | null
  sessionPartition: string | null
}): string {
  const browserSessionProfiles = useAppStore((s) => s.browserSessionProfiles)
  const activeAlfredProfileId = useAppStore((s) => s.activeAlfredProfileId)
  const fallbackBrowserPartition = activeAlfredProfileId
    ? getAlfredProfileBrowserDefaultPartition(activeAlfredProfileId)
    : null
  const defaultSessionProfile = browserSessionProfiles.find((p) => p.id === 'default') ?? null
  const sessionProfile = sessionProfileId
    ? (browserSessionProfiles.find((p) => p.id === sessionProfileId) ?? null)
    : defaultSessionProfile
  return (
    sessionPartition ??
    sessionProfile?.partition ??
    defaultSessionProfile?.partition ??
    fallbackBrowserPartition ??
    ALFRED_BROWSER_PARTITION
  )
}
