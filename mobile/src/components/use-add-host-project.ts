import { useCallback, useEffect, useRef, useState } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'
import {
  addHostProject,
  browseHostDirectory,
  type HostDirectory
} from './add-host-project-operations'

export function useAddHostProject(
  client: Pick<RpcClient, 'sendRequest'> | null,
  visible: boolean,
  onAdded: (repo: MobileWorkspaceRepo) => void
) {
  const [path, setPath] = useState('~')
  const [directory, setDirectory] = useState<HostDirectory | null>(null)
  const [kind, setKind] = useState<'git' | 'folder'>('git')
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const revision = useRef(0)
  const pending = useRef(false)

  const browse = useCallback(
    async (target: string) => {
      if (!client || pending.current) {
        return
      }
      const id = ++revision.current
      pending.current = true
      setBusy(true)
      setError('')
      setDirectory(null)
      try {
        const reply = await browseHostDirectory.request(client, { path: target })
        if (id !== revision.current) {
          return
        }
        const listing = browseHostDirectory.interpret(reply)
        setDirectory(listing)
        setPath(listing.resolvedPath)
      } catch (cause) {
        if (id === revision.current) {
          setError(cause instanceof Error ? cause.message : 'Could not browse the host.')
        }
      } finally {
        if (id === revision.current) {
          pending.current = false
          setBusy(false)
        }
      }
    },
    [client]
  )

  useEffect(() => {
    pending.current = false
    setBusy(false)
    setAdding(false)
    setDirectory(null)
    if (visible) {
      void browse('~')
    }
    return () => {
      revision.current++
    }
  }, [browse, visible])

  async function add() {
    if (!client || !directory || path !== directory.resolvedPath || pending.current) {
      return
    }
    const id = ++revision.current
    pending.current = true
    setBusy(true)
    setAdding(true)
    setError('')
    try {
      const reply = await addHostProject.request(
        client,
        { path: directory.resolvedPath, kind },
        { failWhenDisconnected: true }
      )
      if (id !== revision.current) {
        return
      }
      if (!reply.ok && ['forbidden', 'method_not_found'].includes(reply.error.code)) {
        throw new Error('Update desktop to add projects from this interface, then reconnect.')
      }
      onAdded(addHostProject.interpret(reply))
    } catch (cause) {
      if (id === revision.current) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Could not add the project. Check the host before retrying.'
        )
      }
    } finally {
      if (id === revision.current) {
        pending.current = false
        setBusy(false)
        setAdding(false)
      }
    }
  }

  return { path, setPath, directory, kind, setKind, busy, adding, error, browse, add }
}
