import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import { ChevronDown, Folder, GitBranch } from 'lucide-react-native'
import { joinPath } from '../../../src/shared/server-directory-paths'
import { isWindowsAbsolutePathLike } from '../../../src/shared/cross-platform-path'
import { colors } from '../theme/mobile-theme'
import { addProjectStyles as styles } from './add-project-styles'
import { newWorktreeFormStyles as form } from './new-worktree-form-styles'
import type { AddProjectFlow } from './use-add-project-flow'

function ParentFolder({ flow }: { flow: AddProjectFlow }) {
  return (
    <View style={styles.field}>
      <Text style={form.label}>Parent folder</Text>
      <View style={styles.fieldRow}>
        <TextInput
          accessibilityLabel="Parent folder"
          style={[form.input, styles.grow]}
          value={flow.parent}
          onChangeText={flow.setParent}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!flow.busy}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose parent folder"
          style={styles.iconButton}
          disabled={!!flow.busy}
          onPress={flow.openLocation}
        >
          <Folder size={18} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  )
}

export function AddProjectCloneStep({ flow }: { flow: AddProjectFlow }) {
  return (
    <>
      <Text style={[styles.description, styles.field]}>
        Enter the Git URL and choose where to clone it.
      </Text>
      <View style={styles.field}>
        <Text style={form.label}>Git URL</Text>
        <TextInput
          accessibilityLabel="Git URL"
          style={form.input}
          value={flow.url}
          onChangeText={flow.setUrl}
          editable={!flow.busy}
          placeholder="https://host/owner/repository.git"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>
      <ParentFolder flow={flow} />
    </>
  )
}

export function AddProjectCreateStep({ flow }: { flow: AddProjectFlow }) {
  const [expanded, setExpanded] = useState(false)
  const path = joinPath(
    flow.parent,
    flow.name.trim() || 'project-name',
    isWindowsAbsolutePathLike(flow.parent) ? 'win32' : 'posix'
  )
  return (
    <>
      <Text style={[styles.description, styles.field]}>Create a new Git repository.</Text>
      <View style={styles.field}>
        <Text style={form.label}>Name</Text>
        <TextInput
          accessibilityLabel="Project name"
          style={form.input}
          value={flow.name}
          onChangeText={flow.setName}
          editable={!flow.busy}
          placeholder="my-project"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
        />
      </View>
      <View style={styles.summary}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Project location"
          accessibilityState={{ expanded }}
          disabled={!!flow.busy}
          style={styles.fieldRow}
          onPress={() => setExpanded(!expanded)}
        >
          <GitBranch size={18} color={colors.textMuted} />
          <View style={styles.grow}>
            <Text style={styles.actionTitle}>Git repository in {flow.parent}</Text>
            <Text style={styles.path} numberOfLines={2}>
              {path}
            </Text>
          </View>
          <ChevronDown size={16} color={colors.textMuted} />
        </Pressable>
        {expanded ? <ParentFolder flow={flow} /> : null}
      </View>
      {!flow.host && flow.gitAvailable === false ? (
        <Text accessibilityRole="alert" style={form.error}>
          Git is required to create a project.
        </Text>
      ) : null}
    </>
  )
}
