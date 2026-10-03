import type { ReactNode } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useHostClient } from '../transport/client-context'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { MobileWebShellSessionState } from './mobile-web-shell-session-contract'

export function MobileWebShellFrame({
  hostId,
  state,
  onReload,
  children
}: {
  hostId: string
  state: MobileWebShellSessionState
  onReload: () => void
  children: ReactNode
}) {
  const insets = useSafeAreaInsets()
  const connection = useHostClient(hostId)
  const busy = state.kind === 'fetching' || state.kind === 'activating' || state.kind === 'checking'
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          testID="mobile-web-shell-back"
          onPress={() => router.replace('/')}
          style={styles.button}
        >
          <Text style={styles.label}>Hosts</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          testID="mobile-web-shell-reload"
          disabled={busy}
          style={styles.button}
          onPress={() =>
            Alert.alert(
              'Reload host interface?',
              'Checks for a new interface on your desktop. Unsent text in this view will be lost. Running work stays on the host.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reload', onPress: onReload }
              ]
            )
          }
        >
          <Text style={busy ? styles.status : styles.label}>Reload UI</Text>
        </Pressable>
      </View>
      <Text style={styles.status} testID="mobile-web-shell-connection">
        {connection.state === 'connected'
          ? 'Connected to host'
          : 'Host disconnected · reconnecting in native app'}
        {state.kind === 'ready' ? ` · ${state.buildId.slice(0, 12)}` : ''}
      </Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgBase },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle
  },
  button: { padding: spacing.md },
  label: { color: colors.textPrimary, fontSize: typography.bodySize },
  status: { color: colors.textMuted, fontSize: typography.metaSize, paddingHorizontal: spacing.md }
})
