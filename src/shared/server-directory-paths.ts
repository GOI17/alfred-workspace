import type { FilesystemPathFlavor } from './filesystem-entry-types'
import {
  driveRootOf,
  isDrivePath,
  joinDrivePath,
  parentOfDrivePath
} from './server-directory-drive-paths'

export function joinPath(
  resolvedPath: string,
  name: string,
  pathFlavor: FilesystemPathFlavor = 'posix'
): string {
  // Drive rows in a Windows host-root listing are already absolute (`M:\`).
  if (pathFlavor === 'win32' && resolvedPath === '/' && isDrivePath(name)) {
    return driveRootOf(name)
  }
  if (pathFlavor === 'win32' && isDrivePath(resolvedPath)) {
    return joinDrivePath(resolvedPath, name)
  }
  return resolvedPath === '/' ? `/${name}` : `${resolvedPath}/${name}`
}

export function parentPath(p: string, pathFlavor: FilesystemPathFlavor = 'posix'): string {
  if (pathFlavor === 'win32' && isDrivePath(p)) {
    return parentOfDrivePath(p)
  }
  if (p === '/' || p === '') {
    return '/'
  }
  const parent = p.replace(/\/[^/]+\/?$/, '')
  return parent || '/'
}
