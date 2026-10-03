import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { Folder } from 'lucide-react-native'
import { resolveRuntimePath } from '../../../src/shared/cross-platform-path'
import type { RpcClient } from '../transport/rpc-client'
import { colors } from '../theme/mobile-theme'
import { BottomDrawer } from './BottomDrawer'
import { newWorktreeFormStyles as styles } from './new-worktree-form-styles'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'
import { useAddHostProject } from './use-add-host-project'

export function AddHostProjectDrawer({
  visible,
  client,
  onAdded,
  onClose
}: {
  visible: boolean
  client: RpcClient | null
  onAdded: (repo: MobileWorkspaceRepo) => void
  onClose: () => void
}) {
  const form = useAddHostProject(client, visible, onAdded)
  const directory = form.directory
  const canAdd = Boolean(directory && form.path === directory.resolvedPath && !form.busy)
  return (
    <BottomDrawer
      visible={visible}
      onClose={onClose}
      dragContentToDismiss={false}
      contentScrollable={false}
      fillAvailable
    >
      <View style={styles.header}>
        <Text style={styles.title}>Add project</Text>
        <Text style={styles.emptyText}>
          Choose an existing folder on the paired host. SSH projects must first be added in desktop.
        </Text>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Folder on host</Text>
        <TextInput
          accessibilityLabel="Folder on host"
          style={styles.input}
          value={form.path}
          onChangeText={form.setPath}
          editable={!form.busy}
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={() => void form.browse(form.path)}
        />
      </View>
      <View style={styles.setupChoiceRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.setupChoiceButton}
          disabled={form.busy}
          onPress={() => void form.browse(form.path)}
        >
          <Text style={styles.setupChoiceText}>
            {form.busy && !form.adding ? 'Loading…' : 'Browse'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.setupChoiceButton}
          disabled={form.busy}
          onPress={() => void form.browse('/')}
        >
          <Text style={styles.setupChoiceText}>Root</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={styles.setupChoiceButton}
          disabled={form.busy || !directory}
          onPress={() =>
            directory && void form.browse(resolveRuntimePath(directory.resolvedPath, '..'))
          }
        >
          <Text style={styles.setupChoiceText}>Up</Text>
        </Pressable>
      </View>
      {directory && (
        <FlatList
          data={directory.entries.filter((entry) => entry.isDirectory || entry.isSymlink)}
          style={[styles.field, { flex: 1 }]}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          keyExtractor={(entry) => entry.name}
          ListEmptyComponent={<Text style={styles.emptyText}>No subfolders</Text>}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open folder ${item.name}`}
              style={styles.fieldButton}
              disabled={form.busy}
              onPress={() =>
                void form.browse(resolveRuntimePath(directory.resolvedPath, item.name))
              }
            >
              <Folder size={16} color={colors.textSecondary} />
              <Text style={styles.fieldButtonText}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}
      <View style={styles.setupChoiceRow}>
        {(['git', 'folder'] as const).map((kind) => (
          <Pressable
            key={kind}
            accessibilityRole="radio"
            accessibilityState={{ checked: form.kind === kind }}
            style={[
              styles.setupChoiceButton,
              form.kind === kind && styles.setupChoiceButtonSelected
            ]}
            disabled={form.busy}
            onPress={() => form.setKind(kind)}
          >
            <Text style={styles.setupChoiceText}>
              {kind === 'git' ? 'Git repository' : 'Folder project'}
            </Text>
          </Pressable>
        ))}
      </View>
      {form.error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {form.error}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.advancedToggle} onPress={onClose}>
          <Text style={styles.advancedText}>Cancel</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[styles.createButton, !canAdd && styles.createButtonDisabled]}
          disabled={!canAdd}
          onPress={() => void form.add()}
        >
          <Text style={styles.createText}>{form.adding ? 'Adding…' : 'Add this folder'}</Text>
        </Pressable>
      </View>
    </BottomDrawer>
  )
}
