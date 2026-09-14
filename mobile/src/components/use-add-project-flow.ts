import { requestProjectResult } from './add-project-operations'
import { useEffect, useRef, useState } from 'react'
import type { z } from 'zod'
import type { RpcClient } from '../transport/rpc-client'
import type { MobileWorkspaceRepo } from './new-worktree-modal-types'
import {
  addProjectOnHost,
  browseProjectDirectory,
  browseRemoteProjectDirectory,
  connectProjectSshHost,
  type directoryResultSchema
} from './add-project-operations'

import { useAddProjectHosts, type ProjectSshHost } from './use-add-project-hosts'

export type AddProjectStep = 'start' | 'hosts' | 'browse' | 'clone' | 'create' | 'location'
export type ProjectDirectory = z.output<typeof directoryResultSchema>

export function useAddProjectFlow(props: {
  visible: boolean
  client: RpcClient | null
  defaultParent?: string
  onAdded: (repo: MobileWorkspaceRepo) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<AddProjectStep>('start')
  const [locationReturn, setLocationReturn] = useState<'clone' | 'create'>('clone')
  const [path, setPath] = useState(props.defaultParent || '~')
  const [parent, setParent] = useState(props.defaultParent || '~')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [kind, setKind] = useState<'git' | 'folder'>('git')
  const [directory, setDirectory] = useState<ProjectDirectory | null>(null)
  const { host, setHost, hosts, setHosts, hostsError, gitAvailable, refreshHosts } =
    useAddProjectHosts(props.client, props.visible)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const request = useRef(0)
  const pending = useRef(false)

  useEffect(() => {
    pending.current = false
    setBusy(null)
    if (!props.visible) {
      setStep('start')
    }
    return () => {
      request.current += 1
    }
  }, [props.client, props.visible])

  useEffect(() => {
    if (!host && props.defaultParent) {
      const defaultParent = props.defaultParent
      setPath((value) => (value === '~' ? defaultParent : value))
      setParent((value) => (value === '~' ? defaultParent : value))
    }
  }, [host, props.defaultParent])

  async function perform(
    label: string,
    action: (client: RpcClient, current: () => boolean) => Promise<void>
  ) {
    if (!props.visible || !props.client || pending.current) {
      return
    }
    pending.current = true
    const revision = ++request.current
    const current = () => revision === request.current
    setBusy(label)
    setError('')
    try {
      await action(props.client, current)
    } catch (cause) {
      if (current()) {
        const message = cause instanceof Error ? cause.message : 'Could not add project'
        setError(
          /METHOD_NOT_FOUND|Unknown method|Method not found/i.test(message)
            ? 'Update Orca on the connected host to use this action.'
            : message
        )
      }
    } finally {
      if (current()) {
        pending.current = false
        setBusy(null)
      }
    }
  }

  function readDirectory(client: RpcClient, value: string) {
    return host
      ? requestProjectResult(client, browseRemoteProjectDirectory, {
          targetId: host.id,
          dirPath: value.trim()
        })
      : requestProjectResult(client, browseProjectDirectory, { path: value.trim() })
  }

  async function browse(value: string): Promise<void> {
    if (!value.trim()) {
      return
    }
    await perform('Loading folders…', async (client, current) => {
      const result = await readDirectory(client, value)
      if (current()) {
        setDirectory(result)
        setPath(result.resolvedPath)
      }
    })
  }

  async function submit(): Promise<void> {
    const clone = step === 'clone'
    const create = step === 'create'
    if (
      (clone && !url.trim()) ||
      (create && !name.trim()) ||
      !(clone || create ? parent : path).trim()
    ) {
      return
    }
    await perform(
      clone ? 'Cloning repository…' : create ? 'Creating project…' : 'Adding project…',
      async (client, current) => {
        const folder = await readDirectory(client, clone || create ? parent : path)
        if (!current()) {
          return
        }
        const result = await addProjectOnHost(client, {
          action: clone ? 'clone' : create ? 'create' : 'browse',
          connectionId: host?.id,
          folderPath: folder.resolvedPath,
          url: url.trim(),
          name: name.trim(),
          kind
        })
        if (!current()) {
          return
        }
        if ('error' in result) {
          setError(result.error)
          return
        }
        props.onAdded(result.repo)
      }
    )
  }

  function selectHost(next: ProjectSshHost | null) {
    if (pending.current) {
      return
    }
    request.current += 1
    setHost(next)
    setPath(next ? '~' : props.defaultParent || '~')
    setParent(next ? '~' : props.defaultParent || '~')
    setDirectory(null)
    setName('')
    setUrl('')
    setKind('git')
    setError('')
    setStep('start')
  }

  async function connectHost() {
    if (!host) {
      return
    }
    await perform('Connecting to SSH host…', async (client, current) => {
      const result = await requestProjectResult(
        client,
        connectProjectSshHost,
        { targetId: host.id },
        { timeoutMs: 60_000 }
      )
      if (!current()) {
        return
      }
      if (result.state.status !== 'connected') {
        throw new Error('SSH host is not connected. Try again.')
      }
      setHost({ ...host, connected: true })
      setHosts((entries) =>
        entries.map((entry) => (entry.id === host.id ? { ...entry, connected: true } : entry))
      )
    })
  }

  function goTo(next: AddProjectStep) {
    if (pending.current) {
      return
    }
    setError('')
    setStep(next)
    if (next === 'hosts') {
      refreshHosts()
    }
    if (next === 'browse') {
      void browse(path)
    }
  }

  function back() {
    if (pending.current) {
      return
    }
    setError('')
    if (step === 'start') {
      props.onClose()
    } else {
      setStep(step === 'location' ? locationReturn : 'start')
    }
  }

  function openLocation() {
    if (step !== 'clone' && step !== 'create') {
      return
    }
    setLocationReturn(step)
    setPath(parent)
    setDirectory(null)
    setStep('location')
    void browse(parent)
  }

  function selectLocation() {
    void perform('Selecting folder…', async (client, current) => {
      const result = await readDirectory(client, path)
      if (current()) {
        setParent(result.resolvedPath)
        setStep(locationReturn)
      }
    })
  }

  return {
    step,
    path,
    setPath,
    parent,
    setParent,
    name,
    setName,
    url,
    setUrl,
    kind,
    setKind,
    directory,
    host,
    hosts,
    hostsError,
    busy,
    error,
    gitAvailable,
    browse,
    submit,
    selectHost,
    connectHost,
    goTo,
    back,
    openLocation,
    selectLocation
  }
}

export type AddProjectFlow = ReturnType<typeof useAddProjectFlow>
