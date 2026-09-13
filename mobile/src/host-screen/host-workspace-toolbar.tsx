import { Filter, Plus } from 'lucide-react-native'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { MobileSearchField } from '../components/MobileSearchField'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { HostScreenController } from './use-host-screen-controller'

export function HostWorkspaceToolbar({ controller }: { controller: HostScreenController }) {
  const { actions, connState, insets, settings, state } = controller
  const hasFilters = settings.activeFilterCount > 0
  const canCreate = connState === 'connected'

  return (
    <View style={[styles.toolbar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          hasFilters && styles.filterActive,
          pressed && styles.pressed
        ]}
        onPress={() => {
          Keyboard.dismiss()
          state.setShowFilterModal(true)
        }}
        accessibilityRole="button"
        accessibilityLabel={`Filter workspaces${hasFilters ? `, ${settings.activeFilterCount} active` : ''}`}
      >
        <Filter size={16} color={hasFilters ? colors.textPrimary : colors.textSecondary} />
        {hasFilters ? <Text style={styles.filterCount}>{settings.activeFilterCount}</Text> : null}
      </Pressable>
      <View style={styles.search}>
        <MobileSearchField
          value={state.search}
          onChangeText={state.setSearch}
          placeholder="Search worktrees…"
          accessibilityLabel="Search worktrees"
        />
      </View>
      <Pressable
        style={({ pressed }) => [
          styles.button,
          styles.createButton,
          !canCreate && styles.disabled,
          pressed && styles.pressed
        ]}
        onPress={() => {
          Keyboard.dismiss()
          actions.openNewWorktreeModal()
        }}
        disabled={!canCreate}
        accessibilityRole="button"
        accessibilityLabel="New worktree"
        accessibilityState={{ disabled: !canCreate }}
      >
        <Plus size={16} color={colors.bgBase} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.button
  },
  filterActive: { backgroundColor: colors.bgRaised },
  filterCount: { fontSize: typography.metaSize, color: colors.textPrimary },
  // Reserve the clear button's height so typing does not shift the toolbar.
  search: { flex: 1, minWidth: 0, minHeight: 56, justifyContent: 'center' },
  createButton: { backgroundColor: colors.surfaceBright },
  disabled: { opacity: 0.6 },
  pressed: { opacity: 0.7 }
})
