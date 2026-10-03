import type { AlfredRuntimeService } from '../alfred-runtime'

export function routeDispatcherClientHostedBrowserRpc(
  runtime: AlfredRuntimeService,
  method: string,
  params: unknown
) {
  const candidate = runtime as AlfredRuntimeService & {
    routeClientHostedBrowserRpc?: AlfredRuntimeService['routeClientHostedBrowserRpc']
  }
  return candidate.routeClientHostedBrowserRpc?.(method, params) ?? { handled: false as const }
}
