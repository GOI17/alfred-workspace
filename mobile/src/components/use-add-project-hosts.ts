import { requestProjectResult } from './add-project-operations'
import { useEffect, useState } from 'react'
import type { RpcClient } from '../transport/rpc-client'
import { projectGitAvailability, projectSshHosts } from './add-project-operations'

export type ProjectSshHost = { id: string; label: string; connected: boolean }

export function useAddProjectHosts(client: RpcClient | null, visible: boolean) {
  const [host, setHost] = useState<ProjectSshHost | null>(null)
  const [hosts, setHosts] = useState<ProjectSshHost[]>([])
  const [hostsError, setHostsError] = useState('')
  const [hostsRevision, setHostsRevision] = useState(0)
  const [gitAvailable, setGitAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    if (!visible || !client) {
      return
    }
    let stale = false
    setHostsError('')
    void requestProjectResult(client, projectSshHosts, undefined)
      .then((result) => {
        if (!stale) {
          setHosts(result.targets)
          setHost((selected) =>
            selected
              ? (result.targets.find((target) => target.id === selected.id) ?? {
                  ...selected,
                  connected: false
                })
              : null
          )
        }
      })
      .catch(() => {
        if (!stale) {
          setHostsError('Could not load SSH hosts. Try again.')
        }
      })
    return () => {
      stale = true
    }
  }, [client, visible, hostsRevision])

  useEffect(() => {
    if (!visible || !client) {
      return
    }
    let stale = false
    void requestProjectResult(client, projectGitAvailability, undefined)
      .then((result) => {
        if (!stale) {
          setGitAvailable(result.available)
        }
      })
      .catch(() => {
        if (!stale) {
          setGitAvailable(null)
        }
      })
    return () => {
      stale = true
    }
  }, [client, visible])

  return {
    host,
    setHost,
    hosts,
    setHosts,
    hostsError,
    gitAvailable,
    refreshHosts: () => setHostsRevision((value) => value + 1)
  }
}
