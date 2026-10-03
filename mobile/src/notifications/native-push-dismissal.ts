import type { AlfredPushPayload } from './push-payload'

export type NativeDismissal = {
  remember(payload: AlfredPushPayload): Promise<void>
  wasDismissed(payload: AlfredPushPayload): Promise<boolean>
}
// Android and web use JavaScript storage; iOS requires the native ledger.
export const nativePushDismissal: NativeDismissal | null = null
