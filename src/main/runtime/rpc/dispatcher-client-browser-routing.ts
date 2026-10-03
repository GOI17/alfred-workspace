import type { AlfredRuntimeService } from '../alfred-runtime'

export function routeDispatcherClientHostedBrowserRpc(
  runtime: AlfredRuntimeService,
  method: string,
  params: unknown
) {
  return runtime.routeClientHostedBrowserRpc?.(method, params) ?? { handled: false as const }
}
