import { isJsonObject } from '../../../../shared/json-object'
export function addLifecycleRejectionMarker(
  payload: string | null,
  code: string,
  reason: string
): string {
  let parsed: Record<string, unknown> = {}
  try {
    const value: unknown = payload ? JSON.parse(payload) : {}
    if (isJsonObject(value)) {
      parsed = value
    }
  } catch {
    // Authority reconciliation only reaches this path with object payloads.
  }
  return JSON.stringify({
    ...parsed,
    _alfredLifecycleRejection: { code, reason }
  })
}

export function hasLifecycleRejectionMarker(payload: string | null): boolean {
  try {
    const value: unknown = JSON.parse(payload ?? 'null')
    if (!isJsonObject(value)) {
      return false
    }
    const marker = value._alfredLifecycleRejection
    return Boolean(
      isJsonObject(marker) && typeof marker.code === 'string' && typeof marker.reason === 'string'
    )
  } catch {
    return false
  }
}
