import { Pressable, Text, View } from 'react-native'
import { ChevronsUpDown, FolderOpen, Globe, Plus } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { newWorktreeFormStyles as form } from './new-worktree-form-styles'
import { addProjectStyles as styles } from './add-project-styles'
import type { AddProjectFlow } from './use-add-project-flow'

export function AddProjectStartStep({
  flow,
  hostLabel,
  connected
}: {
  flow: AddProjectFlow
  hostLabel: string
  connected: boolean
}) {
  const disabled = !connected || !!flow.busy || !!(flow.host && !flow.host.connected)
  return (
    <>
      <View style={styles.host}>
        <Text style={styles.description}>Host</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select host"
          disabled={!!flow.busy}
          style={styles.hostButton}
          onPress={() => flow.goTo('hosts')}
        >
          <Text style={styles.actionTitle} numberOfLines={1}>
            {flow.host?.label ?? hostLabel}
          </Text>
          <ChevronsUpDown size={14} color={colors.textMuted} />
        </Pressable>
      </View>
      {flow.host && !flow.host.connected ? (
        <View style={styles.field}>
          <Text style={styles.description}>Connect to this SSH host to add a project.</Text>
          <Pressable
            accessibilityRole="button"
            style={form.advancedToggle}
            disabled={!connected || !!flow.busy}
            onPress={() => void flow.connectHost()}
          >
            <Text style={form.advancedText}>Connect host</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        style={[styles.action, styles.primaryAction, disabled && form.disabled]}
        onPress={() => flow.goTo('browse')}
      >
        <View style={styles.actionIcon}>
          <FolderOpen size={18} color={colors.textPrimary} />
        </View>
        <View style={styles.actionCopy}>
          <Text style={styles.actionTitle}>
            {flow.host ? 'Open project on SSH host' : 'Browse folder'}
          </Text>
          <Text style={styles.description}>Existing Git repository or folder on this host</Text>
        </View>
      </Pressable>
      <Text style={styles.sectionLabel}>Other ways to add</Text>
      <View style={styles.group}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
            disabled && form.disabled
          ]}
          onPress={() => flow.goTo('clone')}
        >
          <View style={styles.actionIcon}>
            <Globe size={18} color={colors.textMuted} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Clone from URL</Text>
            <Text style={styles.description}>Clone a remote Git repository</Text>
          </View>
        </Pressable>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          style={({ pressed }) => [
            styles.action,
            pressed && styles.pressed,
            disabled && form.disabled
          ]}
          onPress={() => flow.goTo('create')}
        >
          <View style={styles.actionIcon}>
            <Plus size={18} color={colors.textMuted} />
          </View>
          <View style={styles.actionCopy}>
            <Text style={styles.actionTitle}>Create new project</Text>
            <Text style={styles.description}>Start from an empty folder</Text>
          </View>
        </Pressable>
      </View>
    </>
  )
}
