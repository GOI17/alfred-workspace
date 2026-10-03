/**
 * Going back to the previously active alfredd.
 *
 * Rollback is a state operation, not a binary swap. The version dirs are immutable and both
 * are still on disk, so pointing at the old one is trivial; what is not trivial is that both
 * versions share ONE data root, outside either dir. A newer alfredd migrates that root on load
 * — and Alfred's persisted state carries no schema version to migrate against, so the older
 * build cannot be shown to read the result. Rollback therefore restores the pre-activation
 * snapshot, and refuses when restoring it would orphan work (`assessAlfreddRollback`).
 *
 * The order below is the whole safety argument: stop, then restore, then start. Restoring
 * under a running alfredd would replace the store beneath a process holding it open, and
 * starting before restoring would let the old build migrate the new build's state — the
 * failure this is meant to avoid, arrived at from the other side.
 */
import type { SshConnection } from './ssh-connection'
import { execCommand } from './ssh-relay-deploy-helpers'
import { ALFREDD_INSTALL_MODEL } from './remote-install-model'
import { computeRemoteInstallDir } from './ssh-relay-versioned-install'
import { writeRelayFile } from './ssh-relay-install-transfers'
import { RELAY_REMOTE_DIR } from './relay-protocol'
import {
  ALFREDD_STATE_SNAPSHOT_DIR,
  serializeAlfreddActivationRecord,
  withRolledBackVersion,
  type AlfreddActivationRecord
} from './alfredd-activation-record'
import { assessAlfreddRollback, type AlfreddTerminalCensus } from './alfredd-update-plan'
import { evaluateAlfreddActivation, type AlfreddActivationVerdict } from './alfredd-activation-gate'
import {
  ALFREDD_LOG_FILENAME,
  alfreddLaunchCommand,
  parseAlfreddReadinessOutput,
  readAlfreddReadinessCommand
} from './alfredd-remote-launch'
import {
  newestStateMtimeCommand,
  parseNewestStateMtimeSeconds,
  parseAlfreddSnapshotRestore,
  probeAlfreddStateSnapshotCommand,
  restoreAlfreddStateSnapshotCommand
} from './alfredd-state-snapshot'
import {
  alfreddStopFreedTheHost,
  parseAlfreddStopOutcome,
  stopAlfreddCommand
} from './alfredd-remote-process-control'
import { alfreddActivationPath } from './alfredd-activation-record-store'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'

export type AlfreddRollbackOptions = {
  conn: SshConnection
  host: RemoteHostPlatform
  remoteHome: string
  record: AlfreddActivationRecord
  nodePath: string
  userDataDir: string
  bindHost: string
  port: number
  census: AlfreddTerminalCensus
  /** Expected build hash of the rollback target, from the client's copy of those bytes. */
  targetBuildHash: string
  readinessTimeoutMs?: number
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  signal?: AbortSignal
}

export type AlfreddRollbackResult =
  | {
      outcome: 'rolled-back'
      target: string
      discarded: string[]
      verdict: AlfreddActivationVerdict
    }
  | { outcome: 'refused'; code: string; reason: string }
  | { outcome: 'failed'; code: string; reason: string }

const DEFAULT_READINESS_TIMEOUT_MS = 90_000
const READINESS_POLL_MS = 500
const STOP_WAIT_SECONDS = 20

function exec(options: AlfreddRollbackOptions, command: string): Promise<string> {
  return execCommand(options.conn, command, {
    wrapCommand: options.host.commandDialect !== 'powershell',
    signal: options.signal
  })
}

function snapshotDirPath(options: AlfreddRollbackOptions, dirName: string): string {
  return joinRemotePath(
    options.host,
    options.remoteHome,
    RELAY_REMOTE_DIR,
    ALFREDD_STATE_SNAPSHOT_DIR,
    dirName
  )
}

/** Has the store been written since activation? `null` when it cannot be established. */
async function readStateWritesSinceActivation(
  options: AlfreddRollbackOptions
): Promise<boolean | null> {
  if (!options.record.activatedAt) {
    return null
  }
  const activatedAtSeconds = Math.floor(Date.parse(options.record.activatedAt) / 1000)
  if (!Number.isFinite(activatedAtSeconds)) {
    return null
  }
  const newest = parseNewestStateMtimeSeconds(
    await exec(options, newestStateMtimeCommand(options.host, options.userDataDir)).catch(() => '')
  )
  return newest === null ? null : newest >= activatedAtSeconds
}

export async function rollbackAlfredd(
  options: AlfreddRollbackOptions
): Promise<AlfreddRollbackResult> {
  const now = options.now ?? ((): Date => new Date())
  const snapshotPresent = options.record.snapshot
    ? (
        await exec(
          options,
          probeAlfreddStateSnapshotCommand(
            options.host,
            snapshotDirPath(options, options.record.snapshot.dirName)
          )
        ).catch(() => 'ABSENT')
      ).trim() === 'PRESENT'
    : false

  const safety = assessAlfreddRollback({
    record: options.record,
    snapshotPresent,
    census: options.census,
    stateWritesSinceActivation: await readStateWritesSinceActivation(options)
  })
  if (safety.safety === 'unsafe') {
    return { outcome: 'refused', code: safety.code, reason: safety.reason }
  }

  if (options.record.active) {
    const outgoingDir = computeRemoteInstallDir(
      ALFREDD_INSTALL_MODEL,
      options.remoteHome,
      options.record.active
    )
    const stopped = parseAlfreddStopOutcome(
      await exec(
        options,
        stopAlfreddCommand(options.host, outgoingDir, { waitSeconds: STOP_WAIT_SECONDS })
      )
    )
    if (!alfreddStopFreedTheHost(stopped)) {
      return {
        outcome: 'failed',
        code: 'alfredd_rollback_stop_incomplete',
        reason:
          `alfredd ${options.record.active} did not exit within ${STOP_WAIT_SECONDS}s of SIGTERM ` +
          `(${stopped}). Nothing was restored — the store is untouched and the host is still ` +
          'serving the version you tried to leave.'
      }
    }
  }

  // Why between stop and start: the store must be replaced while no alfredd holds it, and
  // before the older build gets a chance to migrate the newer build's state.
  const restored = parseAlfreddSnapshotRestore(
    await exec(
      options,
      restoreAlfreddStateSnapshotCommand(
        options.host,
        options.userDataDir,
        // Guarded by `assessAlfreddRollback`: `unsafe` covers a missing snapshot.
        snapshotDirPath(options, options.record.snapshot?.dirName ?? '')
      )
    ).catch(() => 'FAILED')
  )
  if (restored !== 'restored') {
    return {
      outcome: 'failed',
      code: 'alfredd_rollback_restore_failed',
      reason:
        `The pre-activation snapshot could not be restored (${restored}). alfredd is stopped and ` +
        'the data root may be partially replaced. Do NOT start the older build against it; ' +
        `re-deploy ${options.record.active ?? 'the newer version'}, which can read what is there.`
    }
  }

  const targetDir = computeRemoteInstallDir(
    ALFREDD_INSTALL_MODEL,
    options.remoteHome,
    safety.target
  )
  await exec(
    options,
    alfreddLaunchCommand(options.host, {
      remoteInstallDir: targetDir,
      nodePath: options.nodePath,
      fullVersion: safety.target,
      userDataDir: options.userDataDir,
      bindHost: options.bindHost,
      port: options.port
    })
  )
  const deadline = Date.now() + (options.readinessTimeoutMs ?? DEFAULT_READINESS_TIMEOUT_MS)
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let parsed = parseAlfreddReadinessOutput('')
  while (Date.now() < deadline && parsed.state === 'pending') {
    options.signal?.throwIfAborted()
    parsed = parseAlfreddReadinessOutput(
      await exec(options, readAlfreddReadinessCommand(options.host, targetDir))
    )
    if (parsed.state === 'pending') {
      await sleep(READINESS_POLL_MS)
    }
  }
  const verdict = evaluateAlfreddActivation(parsed.state === 'ready' ? parsed.readiness : null, {
    buildHash: options.targetBuildHash,
    fullVersion: safety.target
  })
  if (verdict.decision === 'reject') {
    return {
      outcome: 'failed',
      code: verdict.code,
      reason:
        `The rollback target ${safety.target} did not come up healthy: ${verdict.reason} The ` +
        `store has been restored to its pre-activation state. Its stderr is at ` +
        `${joinRemotePath(options.host, targetDir, ALFREDD_LOG_FILENAME)}.`
    }
  }

  // Why the record is written last: until the target is proven serving, `active` still names
  // the version an operator would need to bring back, and `previous` still names this target.
  await writeRelayFile(
    options.conn,
    options.host,
    alfreddActivationPath(options.host, options.remoteHome),
    serializeAlfreddActivationRecord(withRolledBackVersion(options.record, now())),
    { signal: options.signal }
  )
  return {
    outcome: 'rolled-back',
    target: safety.target,
    discarded: safety.safety === 'lossy' ? safety.discards : [],
    verdict
  }
}
