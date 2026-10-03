import { createRuntimeServiceTestDouble } from './runtime-service-test-double'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getDefaultRepoHookSettings } from '../../shared/constants'
import type { Repo } from '../../shared/repo-types'
import { parsePairingCode } from '../../shared/pairing'
import { RemoteRuntimeRequestConnection } from '../../shared/remote-runtime-request-connection'

import { AlfredRuntimeRpcServer } from './runtime-rpc'

const REMOTE_RUNTIME_TEST_TIMEOUT_MS = 15_000
const REMOTE_RUNTIME_REQUEST_TIMEOUT_MS = 5_000

describe('remote runtime request connection integration', () => {
  it(
    'fetches repos through the real E2EE WebSocket runtime',
    { timeout: REMOTE_RUNTIME_TEST_TIMEOUT_MS },
    async () => {
      const userDataPath = mkdtempSync(join(tmpdir(), 'alfred-runtime-request-'))
      const repoPath = join(userDataPath, 'repo')
      const repos: Repo[] = [
        {
          id: 'repo-1',
          path: repoPath,
          displayName: 'repo',
          badgeColor: 'blue',
          addedAt: 1,
          hookSettings: getDefaultRepoHookSettings(),
          worktreeBaseRef: 'main',
          kind: 'git'
        }
      ]
      const runtime = createRuntimeServiceTestDouble({
        configureNotificationDismissalStore: () => {},
        getRuntimeId: () => 'fetch-runtime-test',
        getStartedAt: () => 1,
        cleanupSubscriptionsForConnection: () => {},
        cancelMobileDictationForConnection: () => {},
        onClientDisconnected: () => {},
        listRepos: () => repos
      })
      const server = new AlfredRuntimeRpcServer({
        runtime,
        userDataPath,
        enableWebSocket: true,
        wsPort: 0
      })

      await server.start()
      try {
        const offer = server.createPairingOffer({ name: 'integration', scope: 'runtime' })
        if (!offer.available) {
          throw new Error('pairing unavailable')
        }
        const pairing = parsePairingCode(offer.pairingUrl)
        if (!pairing) {
          throw new Error('invalid pairing')
        }
        const connection = new RemoteRuntimeRequestConnection(pairing)
        try {
          await expect(
            connection.request('repo.list', undefined, REMOTE_RUNTIME_REQUEST_TIMEOUT_MS)
          ).resolves.toMatchObject({
            ok: true,
            result: { repos }
          })
        } finally {
          connection.close()
        }
      } finally {
        await server.stop()
        rmSync(userDataPath, { recursive: true, force: true })
      }
    }
  )
})
