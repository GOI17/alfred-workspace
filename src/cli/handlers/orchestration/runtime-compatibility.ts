import { RuntimeClientError } from '../../runtime-client'

export function resolveCompatibilityCliCommand(): 'alfred' | 'alfred-ide' | 'alfred-dev' {
  const configured = process.env.ALFRED_CLI_COMMAND
  if (configured === 'alfred' || configured === 'alfred-ide' || configured === 'alfred-dev') {
    return configured
  }
  return process.platform === 'linux' ? 'alfred-ide' : 'alfred'
}

export function resolvePackagedWindowsCompatibilityCommand(): 'alfred' | 'alfred-ide' | undefined {
  if (process.env.ALFRED_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = process.env.ALFRED_CLI_COMMAND
  if (command === 'alfred' || command === 'alfred-ide') {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    'The packaged Alfred launcher did not provide a valid resume command. No question was created.'
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.ALFRED_DEV_CLI_INVOCATION === '1' ||
    (process.env.ALFRED_USER_DATA_PATH?.includes('alfred-dev') ?? false)
  )
}
