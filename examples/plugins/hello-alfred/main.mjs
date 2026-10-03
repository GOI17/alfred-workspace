// Sample Alfred plugin worker entry. Runs inside the out-of-process plugin
// worker (plain Node, no Electron), forked lazily on the first trigger. The
// default export receives the `alfred` API: command registration, event
// handlers, and the capability-gated host API.
export default function activate(alfred) {
  alfred.commands.register('hello-ping', async (args) => {
    const stored = await alfred.host.call('storage.get', { key: 'pings' })
    const count = (typeof stored?.value === 'number' ? stored.value : 0) + 1
    await alfred.host.call('storage.set', { key: 'pings', value: count })
    return { pong: true, count, args: args ?? null }
  })

  alfred.events.on('worktree.created', async (payload) => {
    alfred.log(`worktree created: ${payload.worktreeId} at ${payload.path}`)
    await alfred.host.call('notifications.show', {
      title: 'Worktree created',
      body: payload.path
    })
  })

  alfred.events.on('agent.status.changed', (payload) => {
    alfred.log(`agent status: ${payload.state} in ${payload.worktreeId ?? 'unknown worktree'}`)
  })
}
