import { mobileWebEntryPath } from './bridge/mobile-web-entry-path'

type RouteParams = Readonly<Record<string, string | string[] | undefined>>

export function readNativeHostRouteParams(raw: object): RouteParams {
  const params: Record<string, string | string[]> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      params[key] = value
    } else if (
      Array.isArray(value) &&
      value.every((item): item is string => typeof item === 'string')
    ) {
      params[key] = value
    }
  }
  return params
}

export function nativeHostEntryPath(routeName: string, params: RouteParams): string {
  const hostId = typeof params.hostId === 'string' ? params.hostId : ''
  if (routeName === '[hostId]/web') {
    return mobileWebEntryPath(
      hostId,
      typeof params.initialPath === 'string' ? params.initialPath : undefined
    )
  }
  const pathParams = new Set<string>()
  const pathname = `/h/${routeName.replace(/\[([^\]]+)\]/g, (_match, key: string) => {
    pathParams.add(key)
    const value = params[key]
    return typeof value === 'string' ? encodeURIComponent(value) : ''
  })}`.replace(/\/index$/, '')
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (pathParams.has(key) || key === 'initialPath' || value === undefined) {
      continue
    }
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item)
    }
  }
  return mobileWebEntryPath(hostId, `${pathname}${query.size ? `?${query}` : ''}`)
}
