import { useState } from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { ArrowUp, Folder, RefreshCw } from 'lucide-react-native'
import { joinPath, parentPath } from '../../../src/shared/server-directory-paths'
import { isWindowsAbsolutePathLike } from '../../../src/shared/cross-platform-path'
import { colors } from '../theme/mobile-theme'
import { addProjectStyles as styles } from './add-project-styles'
import { newWorktreeFormStyles as form } from './new-worktree-form-styles'
import type { AddProjectFlow } from './use-add-project-flow'

export function AddProjectFolderStep({ flow }: { flow: AddProjectFlow }) {
  const [query, setQuery] = useState('')
  const { directory, busy } = flow
  const pathFlavor =
    directory?.pathFlavor ??
    (isWindowsAbsolutePathLike(directory?.resolvedPath ?? '') ? 'win32' : 'posix')
  const entries =
    directory?.entries.filter(
      (entry) =>
        (entry.isDirectory || entry.isSymlink) &&
        entry.name.toLowerCase().includes(query.toLowerCase())
    ) ?? []
  return (
    <>
      <Text style={[styles.description, styles.field]}>Navigate to a directory and select it.</Text>
      <View style={styles.field}>
        <Text style={form.label}>Folder path</Text>
        <View style={styles.fieldRow}>
          <TextInput
            accessibilityLabel="Folder path"
            style={[form.input, styles.grow]}
            value={flow.path}
            onChangeText={flow.setPath}
            editable={!busy}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => void flow.browse(flow.path)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Load folder"
            style={styles.iconButton}
            disabled={!!busy || !flow.path.trim()}
            onPress={() => void flow.browse(flow.path)}
          >
            <RefreshCw size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
      {directory ? (
        <View style={styles.field}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Parent folder"
            style={form.advancedToggle}
            disabled={!!busy}
            onPress={() => void flow.browse(parentPath(directory.resolvedPath, pathFlavor))}
          >
            <ArrowUp size={16} color={colors.textSecondary} />
            <Text style={form.advancedText}>Parent folder</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Search folders"
            style={form.input}
            placeholder="Search folders"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ScrollView
            style={styles.directoryList}
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
          >
            {entries.map((entry) => (
              <Pressable
                key={entry.name}
                accessibilityRole="button"
                disabled={!!busy}
                style={styles.action}
                onPress={() =>
                  void flow.browse(joinPath(directory.resolvedPath, entry.name, pathFlavor))
                }
              >
                <Folder size={16} color={colors.textMuted} />
                <Text style={[styles.actionTitle, styles.grow]} numberOfLines={1}>
                  {entry.name}
                </Text>
              </Pressable>
            ))}
            {entries.length === 0 ? (
              <Text style={[styles.description, styles.field]}>No folders found</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
      {flow.step === 'browse' ? (
        <View style={styles.field}>
          <Text style={form.label}>Open as</Text>
          <View style={form.setupChoiceRow}>
            {(['git', 'folder'] as const).map((kind) => (
              <Pressable
                key={kind}
                accessibilityRole="radio"
                accessibilityState={{ checked: kind === flow.kind }}
                disabled={!!busy}
                onPress={() => flow.setKind(kind)}
                style={[
                  form.setupChoiceButton,
                  kind === flow.kind && form.setupChoiceButtonSelected
                ]}
              >
                <Text style={form.setupChoiceText}>
                  {kind === 'git' ? 'Git repository' : 'Folder'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </>
  )
}
