import type { RpcClient } from '../../transport/rpc-client'
import type { BridgeRefusal } from './bridge-caps'
import type { BridgeStreamEndReason } from './bridge-client-subscriptions'
import type { BridgeGrants } from './bridge-envelope'

/** Nothing here is recoverable in place; each is worth a line in a log and none is retried. */
export type BridgeRpcClientDiagnostic =
  | { kind: 'refused'; refusal: BridgeRefusal }
  | { kind: 'send-failed'; error: unknown }
  | { kind: 'stream-ended'; reason: BridgeStreamEndReason }
  | { kind: 'stream-failed'; error: unknown }
  | { kind: 'state-out-of-order' }
  | { kind: 'binary-frame-dropped' }
  | { kind: 'unknown-id' }

/** What `init` said this page is attached to. `grants` is what a call site checks before it posts. */
export type BridgeShellSession = {
  sessionId: string
  buildId: string
  grants: BridgeGrants
  clientId?: string | null
  initialPath?: string
  host?: { id: string; name: string }
}

export type BridgeRpcClientOptions = {
  /** Posts one frame to the shell. May throw; nothing about returning proves delivery. */
  send: (json: string) => void
  onMessage: (handler: (json: string) => void) => () => void
  onDiagnostic?: (diagnostic: BridgeRpcClientDiagnostic) => void
}

export type BridgeRpcClient = RpcClient & {
  /** Fires once `init` has landed, immediately if it already has. Mount no screen before it. */
  onReady: (listener: () => void) => () => void
  getShellSession: () => BridgeShellSession | null
}
