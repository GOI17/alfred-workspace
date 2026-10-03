import { track } from '@/lib/telemetry'
import type { EventProps } from '../../../../shared/telemetry-events'

export type AlfredCliFeatureTipSource = EventProps<'alfred_cli_feature_tip_shown'>['source']
export type AlfredCliFeatureTipSetupResult =
  EventProps<'alfred_cli_feature_tip_setup_result'>['result']
export type CmdJPaletteFeatureTipSource = EventProps<'cmd_j_palette_feature_tip_shown'>['source']

export function getAlfredCliFeatureTipTelemetrySource(value: unknown): AlfredCliFeatureTipSource {
  return value === 'app_open' ? 'app_open' : 'manual'
}

export function trackAlfredCliFeatureTipShown(source: AlfredCliFeatureTipSource): void {
  track('alfred_cli_feature_tip_shown', { source })
}

export function trackAlfredCliFeatureTipSetupClicked(source: AlfredCliFeatureTipSource): void {
  track('alfred_cli_feature_tip_setup_clicked', { source })
}

export function trackAlfredCliFeatureTipSetupResult(
  source: AlfredCliFeatureTipSource,
  result: AlfredCliFeatureTipSetupResult
): void {
  track('alfred_cli_feature_tip_setup_result', { source, result })
}

export function trackCmdJPaletteFeatureTipShown(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_shown', { source })
}

export function trackCmdJPaletteFeatureTipAcknowledged(source: CmdJPaletteFeatureTipSource): void {
  track('cmd_j_palette_feature_tip_acknowledged', { source })
}
