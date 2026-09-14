import { StyleSheet } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'

export const addProjectStyles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  title: { flex: 1, color: colors.textPrimary, fontSize: typography.titleSize, fontWeight: '600' },
  iconButton: { padding: spacing.sm },
  host: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  hostButton: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgPanel,
    borderRadius: radii.button
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64
  },
  primaryAction: {
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radii.input,
    backgroundColor: colors.bgRaised,
    marginBottom: spacing.lg
  },
  actionIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: typography.bodySize, fontWeight: '500', color: colors.textPrimary },
  description: { fontSize: typography.metaSize, color: colors.textMuted, marginTop: spacing.xs },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: typography.metaSize,
    marginBottom: spacing.sm,
    textTransform: 'uppercase'
  },
  group: {
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.input,
    overflow: 'hidden',
    marginBottom: spacing.md
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderSubtle },
  pressed: { backgroundColor: colors.bgRaised },
  field: { marginBottom: spacing.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  summary: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radii.input,
    marginBottom: spacing.md,
    backgroundColor: colors.bgPanel
  },
  directoryList: { maxHeight: 240 },
  path: {
    fontFamily: typography.monoFamily,
    color: colors.textMuted,
    fontSize: typography.metaSize,
    marginTop: spacing.sm
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm
  },
  footer: { marginTop: spacing.md },
  fullButton: { width: '100%', paddingVertical: spacing.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md }
})
