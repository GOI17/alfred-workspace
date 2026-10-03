import type { TerminalFreezeReport } from './components/terminal-pane/terminal-freeze-report'
import type { TypingDiagnosticBridge } from './lib/typing-latency/diagnostic'

declare global {
  // oxlint-disable-next-line typescript/consistent-type-definitions -- Window declarations must merge with the DOM library.
  interface Window {
    __alfredTerminalFreezeReport?: () => Promise<TerminalFreezeReport>
    __alfredTypingDiagnostic?: TypingDiagnosticBridge
    __alfredContextualTourGlobalKeyGuardInstalled?: boolean
  }
  var __alfredAtlasFontProbe:
    | ((mismatch: { desired?: string; actual?: string }) => void)
    | undefined
}
