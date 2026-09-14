import { Pressable, ScrollView, Text, View } from 'react-native'
import { Check, Monitor, Server } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { addProjectStyles as styles } from './add-project-styles'
import { newWorktreeFormStyles as form } from './new-worktree-form-styles'
import type { AddProjectFlow } from './use-add-project-flow'

export function AddProjectHostStep({
  flow,
  hostLabel
}: {
  flow: AddProjectFlow
  hostLabel: string
}) {
  return (
    <>
      <ScrollView
        style={styles.directoryList}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: !flow.host }}
          style={styles.action}
          onPress={() => flow.selectHost(null)}
        >
          <Monitor size={18} color={colors.textMuted} />
          <Text style={[styles.actionTitle, styles.grow]}>{hostLabel}</Text>
          {!flow.host ? <Check size={16} color={colors.textPrimary} /> : null}
        </Pressable>
        {flow.hosts.map((host) => (
          <Pressable
            key={host.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: flow.host?.id === host.id }}
            style={styles.action}
            onPress={() => flow.selectHost(host)}
          >
            <Server size={18} color={colors.textMuted} />
            <View style={styles.grow}>
              <Text style={styles.actionTitle}>{host.label}</Text>
              <Text style={styles.description}>
                {host.connected ? 'Connected' : 'Connect to use'} · SSH
              </Text>
            </View>
            {flow.host?.id === host.id ? <Check size={16} color={colors.textPrimary} /> : null}
          </Pressable>
        ))}
      </ScrollView>
      {flow.hostsError ? (
        <View>
          <Text style={form.error} accessibilityRole="alert">
            {flow.hostsError}
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.back}
            onPress={() => flow.goTo('hosts')}
          >
            <Text style={styles.actionTitle}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  )
}
