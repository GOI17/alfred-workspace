// A native deep link can select a screen, never another host or a nested container.
export function mobileWebEntryPath(hostId: string, requested?: string): string {
  const root = `/h/${encodeURIComponent(hostId)}`
  if (!requested?.startsWith('/') || requested.startsWith('//')) {
    return root
  }
  try {
    const url = new URL(requested, 'https://orca.invalid')
    if (
      url.origin !== 'https://orca.invalid' ||
      url.searchParams.has('hostId') ||
      (url.pathname !== root && !url.pathname.startsWith(`${root}/`)) ||
      url.pathname === `${root}/web` ||
      url.pathname === `${root}/edit`
    ) {
      return root
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return root
  }
}
