import { describe, expect, it } from 'vitest'
import {
  appendAlfredRpcOutput,
  resolveAlfredCliCommand,
  resolveAlfredCliInvocation
} from './live-remote-freeze-rpc.mjs'

describe('live remote freeze RPC', () => {
  it('resolves the Alfred CLI for managed, dev, Linux, and default runtimes', () => {
    expect(resolveAlfredCliCommand({ env: { ALFRED_CLI_COMMAND: 'custom-alfred' } })).toBe(
      'custom-alfred'
    )
    expect(resolveAlfredCliCommand({ env: { ALFRED_DEV_REPO_ROOT: '/repo' } })).toBe('alfred-dev')
    expect(resolveAlfredCliCommand({ env: {}, platform: 'linux' })).toBe('alfred-ide')
    expect(resolveAlfredCliCommand({ env: {}, platform: 'win32' })).toBe('alfred')
  })

  it('bypasses the Windows dev cmd shim with the built Node CLI', () => {
    const invocation = resolveAlfredCliInvocation({
      env: {
        APPDATA: 'C:\\Users\\dev\\AppData\\Roaming',
        ALFRED_CLI_COMMAND: 'C:\\repo\\out\\bin\\alfred-dev.cmd',
        ALFRED_DEV_REPO_ROOT: 'C:\\repo'
      },
      platform: 'win32',
      nodeExecutable: 'C:\\Program Files\\nodejs\\node.exe'
    })

    expect(invocation).toMatchObject({
      command: 'C:\\Program Files\\nodejs\\node.exe',
      prefixArgs: ['C:\\repo\\out\\cli\\index.js'],
      env: {
        ALFRED_USER_DATA_PATH: 'C:\\Users\\dev\\AppData\\Roaming\\alfred-dev',
        ALFRED_DEV_CLI_INVOCATION: '1',
        ALFRED_APP_EXECUTABLE: 'C:\\repo\\node_modules\\electron\\dist\\electron.exe',
        ALFRED_APP_EXECUTABLE_NEEDS_APP_ROOT: '1'
      }
    })
  })

  it('caps combined asynchronous output before retaining the overflow chunk', () => {
    const first = appendAlfredRpcOutput('', '1234', 0, 5)
    expect(first).toEqual({ output: '1234', bytes: 4, exceeded: false })

    const overflow = appendAlfredRpcOutput(first.output, '67', first.bytes, 5)
    expect(overflow).toEqual({ output: '1234', bytes: 6, exceeded: true })
  })
})
