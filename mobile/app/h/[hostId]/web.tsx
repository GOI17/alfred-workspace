import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Redirect, router, useLocalSearchParams } from 'expo-router'
import { HostProtocolGate } from '../../../src/components/HostProtocolGate'
import { MobileWebShellScreen } from '../../../src/mobile-web-shell/MobileWebShellScreen'
import {
  nativeHostEntryPath,
  readNativeHostRouteParams
} from '../../../src/mobile-web-shell/native-host-shell-destination'
import { loadHostCatalog } from '../../../src/transport/host-store'
import { colors, spacing, typography } from '../../../src/theme/mobile-theme'

type Selection =
  | { hostId: string; kind: 'loading' | 'unpaired' | 'unavailable' }
  | { hostId: string; kind: 'ready'; name: string }

export default function MobileWebShellRoute({
  routeName = '[hostId]/web',
  routeParams
}: { routeName?: string; routeParams?: object } = {}) {
  const localParams = useLocalSearchParams<{ hostId: string; initialPath?: string }>()
  const params = routeParams ? readNativeHostRouteParams(routeParams) : localParams
  const hostId = typeof params.hostId === 'string' ? params.hostId : ''
  const [selection, setSelection] = useState<Selection>({ hostId, kind: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let stale = false
    setSelection({ hostId, kind: 'loading' })
    void loadHostCatalog()
      .then((hosts) => {
        if (stale) {
          return
        }
        const host = hosts.find((host) => host.id === hostId)
        if (!host || host.credentialStatus === 'missing') {
          setSelection({ hostId, kind: 'unpaired' })
        } else if (host.credentialStatus === 'temporarily-unavailable') {
          setSelection({ hostId, kind: 'unavailable' })
        } else {
          setSelection({ hostId, kind: 'ready', name: host.name })
        }
      })
      .catch(() => {
        if (!stale) {
          setSelection({ hostId, kind: 'unavailable' })
        }
      })
    return () => {
      stale = true
    }
  }, [hostId, attempt])

  if (!hostId) {
    return <Redirect href="/" />
  }
  if (selection.hostId === hostId && selection.kind === 'unpaired') {
    return <Redirect href="/pair-scan" />
  }
  if (selection.hostId === hostId && selection.kind === 'ready') {
    const entryPath = nativeHostEntryPath(routeName, params)
    return (
      <HostProtocolGate hostId={hostId}>
        <MobileWebShellScreen
          key={`${hostId}:${entryPath}`}
          hostId={hostId}
          hostName={selection.name}
          initialPath={entryPath}
        />
      </HostProtocolGate>
    )
  }
  return (
    <View style={styles.pending}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/')}
        style={styles.button}
      >
        <Text style={styles.text}>Hosts</Text>
      </Pressable>
      {selection.kind === 'unavailable' ? (
        <>
          <Text style={styles.text}>
            Could not read this host’s pairing. Unlock your device and try again.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAttempt((value) => value + 1)}
            style={styles.button}
          >
            <Text style={styles.text}>Try again</Text>
          </Pressable>
        </>
      ) : (
        <ActivityIndicator color={colors.textSecondary} accessibilityLabel="Checking host" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  pending: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgBase,
    padding: spacing.lg
  },
  button: { padding: spacing.md },
  text: { color: colors.textPrimary, fontSize: typography.bodySize }
})
