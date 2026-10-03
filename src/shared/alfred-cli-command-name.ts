export function getAlfredCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  if (platform === 'linux') {
    return 'alfred-ide'
  }
  if (platform === 'win32') {
    return 'alfred.cmd'
  }
  return 'alfred'
}
