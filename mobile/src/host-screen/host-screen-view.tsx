import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { hostScreenStyles as styles } from './host-screen-styles'
import { HostWorkspaceToolbar } from './host-workspace-toolbar'
import { HostScreenHeader } from './host-screen-header'
import { HostScreenOverlays } from './host-screen-overlays'
import { HostWorkspaceList } from './host-workspace-list'
import type { HostScreenController } from './use-host-screen-controller'

export function HostScreenView({ controller }: { controller: HostScreenController }) {
  if (controller.state.error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{controller.state.error}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={controller.insets.top}
      >
        <HostScreenHeader controller={controller} />
        <View style={styles.workspaceList}>
          <HostWorkspaceList controller={controller} />
        </View>
        <HostWorkspaceToolbar controller={controller} />
      </KeyboardAvoidingView>
      <HostScreenOverlays controller={controller} />
    </SafeAreaView>
  )
}
