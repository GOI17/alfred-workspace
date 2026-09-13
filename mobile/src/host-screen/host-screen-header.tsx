import { Pressable, Text, View } from 'react-native'
import { ChevronLeft, List, PanelLeftClose } from 'lucide-react-native'
import { StatusDot } from '../components/StatusDot'
import { classifyConnection, type ConnectionVerdict } from '../transport/connection-health'
import { colors } from '../theme/mobile-theme'
import { hostScreenStyles as styles } from './host-screen-styles'
import type { HostScreenController } from './use-host-screen-controller'

function isErrorVerdict(v: ConnectionVerdict): boolean {
  return v.kind === 'warning' || v.kind === 'unreachable' || v.kind === 'auth-failed'
}

export function HostScreenHeader({ controller }: { controller: HostScreenController }) {
  const {
    actions,
    connState,
    embedded,
    forceReconnectHost,
    hostId,
    lastConnectedAt,
    onHideSidebar,
    reconnectAttempts,
    relayRecovery,
    state
  } = controller

  return (
    <View style={styles.topChrome}>
      <View style={styles.statusBar}>
        <Pressable
          style={styles.backButton}
          onPress={actions.leaveHost}
          accessibilityRole="button"
          accessibilityLabel="Back to hosts"
          hitSlop={8}
        >
          <ChevronLeft size={22} color={colors.textPrimary} />
        </Pressable>
        {(() => {
          const headerVerdict = classifyConnection({
            state: connState,
            reconnectAttempts,
            lastConnectedAt,
            ...relayRecovery
          })
          return (
            <>
              <View style={styles.hostIdentity}>
                <StatusDot state={connState} verdict={headerVerdict} />
                <Text style={styles.hostNameText} numberOfLines={1}>
                  {state.hostName || 'Host'}
                </Text>
              </View>
              {connState !== 'connected' &&
                (() => {
                  // Why: auth-failed has its own banner, so suppress the Reconnect button for that verdict.
                  const verdict = headerVerdict
                  const isError = isErrorVerdict(verdict)
                  const showReconnectButton = isError && hostId && verdict.kind !== 'auth-failed'
                  if (!showReconnectButton) {
                    return null
                  }
                  return (
                    <Pressable
                      style={styles.reconnectButton}
                      onPress={() => void forceReconnectHost(hostId!)}
                      hitSlop={8}
                    >
                      <Text style={styles.reconnectButtonText}>Reconnect</Text>
                    </Pressable>
                  )
                })()}
            </>
          )
        })()}
        <Pressable
          style={[styles.backButton, connState !== 'connected' && styles.toolbarIconDisabled]}
          onPress={() => actions.navigateFromHostList(`/h/${hostId}/tasks`)}
          disabled={connState !== 'connected'}
          accessibilityRole="button"
          accessibilityLabel="Tasks"
        >
          <List size={16} color={colors.textSecondary} />
        </Pressable>
        {embedded && onHideSidebar ? (
          <Pressable
            style={styles.sidebarCollapseButton}
            onPress={onHideSidebar}
            accessibilityRole="button"
            accessibilityLabel="Hide sidebar"
            hitSlop={8}
          >
            <PanelLeftClose size={14} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}
