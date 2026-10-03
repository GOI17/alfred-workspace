export const ALFRED_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY = '__alfredFeatureInteractionSource'

export const ALFRED_RUNTIME_RPC_BROWSER_UI_SOURCE = 'browser-pane-ui'

export function withBrowserPaneUiRuntimeRpcSource(value: unknown): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      [ALFRED_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY]: ALFRED_RUNTIME_RPC_BROWSER_UI_SOURCE
    }
  }
  return {
    ...value,
    [ALFRED_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY]: ALFRED_RUNTIME_RPC_BROWSER_UI_SOURCE
  }
}

export function isBrowserPaneUiRuntimeRpcParams(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ALFRED_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY in value &&
    value[ALFRED_RUNTIME_RPC_FEATURE_INTERACTION_SOURCE_KEY] ===
      ALFRED_RUNTIME_RPC_BROWSER_UI_SOURCE
  )
}
