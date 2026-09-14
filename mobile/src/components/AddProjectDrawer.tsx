import { useEffect, type RefObject } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { ArrowLeft, X } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import type { RpcClient } from '../transport/rpc-client'
import { BottomDrawer } from './BottomDrawer'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'
import { newWorktreeFormStyles as form } from './new-worktree-form-styles'
import { addProjectStyles as styles } from './add-project-styles'
import { useAddProjectFlow } from './use-add-project-flow'
import { AddProjectStartStep } from './AddProjectStartStep'
import { AddProjectHostStep } from './AddProjectHostStep'
import { AddProjectFolderStep } from './AddProjectFolderStep'
import { AddProjectCloneStep, AddProjectCreateStep } from './AddProjectCreationSteps'

export function AddProjectDrawer(props: {
  visible: boolean
  client: RpcClient | null
  backHandlerRef?: RefObject<(() => void) | null>
  hostLabel?: string
  defaultParent?: string
  onAdded: (repo: MobileWorkspaceRepo) => void
  onClose: () => void
}) {
  const flow = useAddProjectFlow(props)
  useEffect(() => {
    if (!props.backHandlerRef) {
      return
    }
    props.backHandlerRef.current = flow.back
    return () => {
      if (props.backHandlerRef) {
        props.backHandlerRef.current = null
      }
    }
  }, [props.backHandlerRef, flow.back])
  const titles = {
    start: 'Add a project',
    hosts: 'Select host',
    browse: 'Browse host filesystem',
    clone: 'Clone from URL',
    create: 'New project',
    location: 'Choose parent folder'
  }
  const action =
    flow.step === 'clone'
      ? 'Clone'
      : flow.step === 'create'
        ? 'Create project'
        : flow.step === 'location'
          ? 'Select folder'
          : 'Add project'
  const hasAction = flow.step !== 'start' && flow.step !== 'hosts'
  const disabled =
    !props.client ||
    !!flow.busy ||
    (flow.step === 'clone'
      ? !flow.url.trim() || !flow.parent.trim()
      : flow.step === 'create'
        ? !flow.name.trim() || !flow.parent.trim() || (!flow.host && flow.gitAvailable === false)
        : !flow.path.trim())
  const close = () => {
    if (!flow.busy) {
      props.onClose()
    }
  }
  return (
    <BottomDrawer visible={props.visible} onClose={close} dragContentToDismiss={false}>
      {flow.step !== 'start' ? (
        <Pressable
          accessibilityRole="button"
          disabled={!!flow.busy}
          style={styles.back}
          onPress={flow.back}
        >
          <ArrowLeft size={14} color={colors.textMuted} />
          <Text style={styles.description}>Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.header}>
        <Text style={styles.title}>{titles[flow.step]}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close add project"
          style={styles.iconButton}
          disabled={!!flow.busy}
          onPress={close}
        >
          <X size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      {flow.step === 'start' ? (
        <AddProjectStartStep
          flow={flow}
          hostLabel={props.hostLabel || 'Connected host'}
          connected={!!props.client}
        />
      ) : null}
      {flow.step === 'hosts' ? (
        <AddProjectHostStep flow={flow} hostLabel={props.hostLabel || 'Connected host'} />
      ) : null}
      {flow.step === 'browse' || flow.step === 'location' ? (
        <AddProjectFolderStep key={flow.directory?.resolvedPath} flow={flow} />
      ) : null}
      {flow.step === 'clone' ? <AddProjectCloneStep flow={flow} /> : null}
      {flow.step === 'create' ? <AddProjectCreateStep flow={flow} /> : null}
      {flow.error ? (
        <Text accessibilityRole="alert" style={form.error}>
          {flow.error}
        </Text>
      ) : null}
      {!props.client ? <Text style={form.error}>Connect to a host to add a project.</Text> : null}
      {hasAction ? (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            style={[form.createButton, styles.fullButton, disabled && form.createButtonDisabled]}
            onPress={() => (flow.step === 'location' ? flow.selectLocation() : void flow.submit())}
          >
            <Text style={form.createText}>{action}</Text>
          </Pressable>
        </View>
      ) : null}
      {flow.busy ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.description}>{flow.busy}</Text>
        </View>
      ) : null}
    </BottomDrawer>
  )
}
